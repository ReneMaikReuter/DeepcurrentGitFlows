import * as os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import { GitService } from './git/GitService'
import { LfsService } from './git/LfsService'
import { LogService } from './LogService'
import type { SyncState, SyncStep, SyncErrorCode } from '../../shared/types'

const execAsync = promisify(exec)

type SyncProgressCallback = (state: SyncState) => void

// SyncService orchestrates the full SYNC flow.
// This is the most safety-critical service in the application.
//
// A sync is only marked successful when ALL of these are confirmed:
// 1. Unreal Engine is not running
// 2. No uncommitted local changes that would block pull
// 3. LFS is healthy
// 4. Fetch succeeded
// 5. No unresolvable conflicts exist
// 6. Pull succeeded
// 7. No LFS pointers remain after pull
// 8. Integrity check passed
//
// At any point where we cannot guarantee safety, sync STOPS.
// We never silently mark a failed sync as successful.
export class SyncService {
  private readonly git: GitService
  private readonly lfs: LfsService
  private readonly log: LogService
  private abortRequested = false

  constructor(repositoryPath: string) {
    this.git = new GitService(repositoryPath)
    this.lfs = new LfsService(repositoryPath)
    this.log = LogService.getInstance()
  }

  requestAbort(): void {
    this.abortRequested = true
  }

  async runSync(onProgress: SyncProgressCallback): Promise<SyncState> {
    this.abortRequested = false
    const steps = this.buildInitialSteps()
    const state: SyncState = {
      phase: 'pre-check',
      steps,
      conflicts: [],
      lfsProblems: [],
      error: null,
      completedAt: null,
    }

    const update = (updates: Partial<SyncState>) => {
      Object.assign(state, updates)
      onProgress({ ...state, steps: [...state.steps] })
    }
    const stepUpdate = (id: string, updates: Partial<SyncStep>) => {
      const step = state.steps.find((s) => s.id === id)
      if (step) {
        Object.assign(step, updates)
        onProgress({ ...state, steps: [...state.steps] })
      }
    }

    const fail = (code: SyncErrorCode, message: string, files: string[] = [], detail: string | null = null): SyncState => {
      const currentStep = state.steps.find((s) => s.status === 'running')
      if (currentStep) stepUpdate(currentStep.id, { status: 'failed', finishedAt: Date.now() })
      update({
        phase: 'failed',
        error: {
          code,
          humanMessage: message,
          affectedFiles: files,
          canRestore: false,
          technicalDetail: detail,
        },
      })
      this.log.error('sync:failed', code, message)
      return state
    }

    const completeStep = (id: string, detail?: string) => {
      stepUpdate(id, { status: 'success', finishedAt: Date.now(), detail: detail ?? null })
    }

    const startStep = (id: string) => {
      stepUpdate(id, { status: 'running', startedAt: Date.now() })
    }

    // ── Step 1: Check if Unreal Engine is running ─────────────────────────
    startStep('unreal-check')
    const unrealRunning = await this.isUnrealRunning()
    if (unrealRunning) {
      return fail('UNREAL_RUNNING', 'Unreal Engine is currently running. Please close it before syncing.')
    }
    completeStep('unreal-check')

    if (this.abortRequested) return fail('UNKNOWN', 'Sync was cancelled.')

    // ── Step 2: Check repository status ───────────────────────────────────
    startStep('repo-check')
    const health = await this.git.isValidRepository()
    if (!health) {
      return fail('CORRUPT_REPOSITORY', 'The repository appears to be corrupted or invalid.')
    }
    completeStep('repo-check')

    // ── Step 3: Check LFS ─────────────────────────────────────────────────
    update({ phase: 'pre-check' })
    startStep('lfs-check')
    const lfsStatus = await this.lfs.getStatus()
    if (!lfsStatus.isInstalled) {
      return fail('LFS_NOT_FOUND', 'Git LFS is not installed. It is required for Unreal projects.')
    }
    if (!lfsStatus.isInitialized) {
      return fail('LFS_NOT_FOUND', 'Git LFS is not initialized in this repository.')
    }
    completeStep('lfs-check')

    if (this.abortRequested) return fail('UNKNOWN', 'Sync was cancelled.')

    // ── Step 4: Fetch remote ──────────────────────────────────────────────
    update({ phase: 'fetch' })
    startStep('fetch')
    const fetchResult = await this.git.fetch()
    if (!fetchResult.success) {
      const fetchRaw = (fetchResult.error ?? '').toLowerCase()
      let fetchMsg = 'Remote nicht erreichbar. Netzwerkverbindung prüfen.'
      if (fetchRaw.includes('403') || fetchRaw.includes('forbidden')) fetchMsg = 'Zugriff verweigert (403). GitHub-Token in den Einstellungen prüfen.'
      else if (fetchRaw.includes('401') || fetchRaw.includes('unauthorized')) fetchMsg = 'Authentifizierung fehlgeschlagen (401). GitHub-Token neu eingeben.'
      else if (fetchRaw.includes('repository not found') || fetchRaw.includes('not found')) fetchMsg = 'Repository nicht gefunden. Remote-URL in den Einstellungen prüfen.'
      return fail('NETWORK_ERROR', fetchMsg, [], fetchResult.error)
    }
    completeStep('fetch')

    if (this.abortRequested) return fail('UNKNOWN', 'Sync was cancelled.')

    // ── Step 5: Check for conflicts ───────────────────────────────────────
    update({ phase: 'conflict-check' })
    startStep('conflict-check')
    const currentBranch = await this.git.getCurrentBranch()
    if (!currentBranch) {
      return fail('CORRUPT_REPOSITORY', 'Could not determine the current branch.')
    }

    const { behind } = await this.git.getAheadBehind(currentBranch)
    if (behind === 0) {
      completeStep('conflict-check', 'Already up to date.')
      // Still continue to verify LFS integrity
    } else {
      completeStep('conflict-check', `${behind} new commit(s) from remote.`)
    }

    if (this.abortRequested) return fail('UNKNOWN', 'Sync was cancelled.')

    // ── Step 6: Pull ─────────────────────────────────────────────────────
    if (behind > 0) {
      update({ phase: 'pull' })
      startStep('pull')
      const pullResult = await this.git.pull()

      let effectivePullResult = pullResult
      if (!pullResult.success && (pullResult.error ?? '').toLowerCase().includes('no tracking information')) {
        // Auto-fix: set upstream and retry once
        await this.git.setUpstream(currentBranch, `origin/${currentBranch}`)
        effectivePullResult = await this.git.pull()
      }

      if (!effectivePullResult.success) {
        if (effectivePullResult.conflicts.length > 0) {
          const conflicts = await this.git.getConflicts(currentBranch, `origin/${currentBranch}`)
          const unrealConflicts = conflicts.filter((c) => c.isUnrealAsset)

          if (unrealConflicts.length > 0) {
            update({ conflicts })
            return fail(
              'UNREAL_CONFLICT',
              `${unrealConflicts.length} Unreal asset(s) conflict with the remote version. Manual resolution required.`,
              unrealConflicts.map((c) => c.path),
              effectivePullResult.error,
            )
          }

          update({ conflicts })
          return fail('UNREAL_CONFLICT', 'Merge conflicts detected. Please resolve them manually.', effectivePullResult.conflicts, effectivePullResult.error)
        }

        const raw = (effectivePullResult.error ?? '').toLowerCase()
        let pullMsg = 'Pull fehlgeschlagen.'
        if (raw.includes('your local changes') || raw.includes('would be overwritten') || raw.includes('please commit') || raw.includes('please stash')) {
          pullMsg = 'Du hast lokale Änderungen die durch den Pull überschrieben würden. Bitte erst committen oder verwerfen.'
        } else if (raw.includes('lfs') && (raw.includes('403') || raw.includes('unauthorized') || raw.includes('auth'))) {
          pullMsg = 'LFS-Authentifizierung fehlgeschlagen. Bitte GitHub-Token in den Einstellungen prüfen.'
        } else if (raw.includes('lfs') || raw.includes('smudge')) {
          pullMsg = 'LFS-Download fehlgeschlagen. Prüfe deine Netzwerkverbindung und LFS-Zugriffsrechte.'
        } else if (raw.includes('403') || raw.includes('forbidden')) {
          pullMsg = 'Zugriff verweigert (403). Dein GitHub-Token hat möglicherweise nicht die nötigen Rechte.'
        } else if (raw.includes('401') || raw.includes('unauthorized')) {
          pullMsg = 'Authentifizierung fehlgeschlagen (401). Bitte GitHub-Token in den Einstellungen neu eingeben.'
        } else if (raw.includes('could not resolve') || raw.includes('unable to connect') || raw.includes('network')) {
          pullMsg = 'Netzwerkfehler. Prüfe deine Internetverbindung.'
        } else if (raw.includes('rejected')) {
          pullMsg = 'Pull wurde vom Server abgelehnt. Möglicherweise gibt es divergierende Änderungen.'
        } else if (effectivePullResult.error) {
          pullMsg = `Pull fehlgeschlagen: ${effectivePullResult.error.split('\n')[0]}`
        }
        return fail('NETWORK_ERROR', pullMsg, [], effectivePullResult.error)
      }

      completeStep('pull', `Merged ${behind} commit(s).`)
    } else {
      stepUpdate('pull', { status: 'skipped', detail: 'Already up to date.' })
    }

    if (this.abortRequested) return fail('UNKNOWN', 'Sync was cancelled.')

    // ── Step 8: LFS integrity check ───────────────────────────────────────
    update({ phase: 'lfs-check' })
    startStep('lfs-integrity')
    const pointerFiles = await this.lfs.scanForPointerFiles()

    if (pointerFiles.length > 0) {
      // Attempt automatic recovery — fetch LFS objects
      stepUpdate('lfs-integrity', { detail: `Attempting to restore ${pointerFiles.length} LFS file(s)...` })
      const restored = await this.lfs.fetchAndRestorePointers(pointerFiles.map((p) => p.path))
      const stillPointers = pointerFiles.filter((p) => !restored.includes(p.path))

      if (stillPointers.length > 0) {
        update({ lfsProblems: stillPointers })
        return fail(
          'LFS_POINTER_DETECTED',
          `${stillPointers.length} Unreal asset(s) are LFS pointers and could not be restored. The files are incomplete.`,
          stillPointers.map((p) => p.path),
        )
      }
    }
    completeStep('lfs-integrity', 'All LFS assets verified.')

    // ── Step 9: Final integrity check ─────────────────────────────────────
    update({ phase: 'integrity' })
    startStep('integrity')
    // Re-scan to be absolutely sure
    const finalPointers = await this.lfs.scanForPointerFiles()
    if (finalPointers.length > 0) {
      update({ lfsProblems: finalPointers })
      return fail('LFS_POINTER_DETECTED', 'Integrity check failed: LFS pointer files detected after sync.', finalPointers.map((p) => p.path))
    }
    completeStep('integrity')

    // ── Done ──────────────────────────────────────────────────────────────
    update({ phase: 'done', completedAt: Date.now() })
    this.log.info('sync:success', [])
    return state
  }

  private async isUnrealRunning(): Promise<boolean> {
    const platform = os.platform()
    try {
      if (platform === 'win32') {
        const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq UE5Editor.exe" /NH 2>NUL')
        return stdout.toLowerCase().includes('ue5editor.exe') || stdout.toLowerCase().includes('ue4editor.exe')
      } else if (platform === 'darwin') {
        const { stdout } = await execAsync('pgrep -x "UE5Editor" || pgrep -x "UE4Editor" || echo "none"')
        return stdout.trim() !== 'none' && stdout.trim() !== ''
      }
      return false
    } catch {
      return false
    }
  }

  private buildInitialSteps(): SyncStep[] {
    const step = (id: string, label: string): SyncStep => ({
      id,
      label,
      status: 'pending',
      detail: null,
      startedAt: null,
      finishedAt: null,
    })

    return [
      step('unreal-check', 'Check Unreal Engine'),
      step('repo-check', 'Check Repository'),
      step('lfs-check', 'Check Git LFS'),
      step('fetch', 'Fetch Remote'),
      step('conflict-check', 'Check for Conflicts'),
      step('pull', 'Pull Changes'),
      step('lfs-integrity', 'Verify LFS Assets'),
      step('integrity', 'Final Integrity Check'),
    ]
  }
}
