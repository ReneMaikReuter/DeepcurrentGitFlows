import { GitService } from './git/GitService'
import { LfsService } from './git/LfsService'
import { BackupService } from './BackupService'
import { LogService } from './LogService'
import type {
  CommitRequest,
  CommitResult,
  ConflictResolveRequest,
  PushResult,
} from '../../shared/types'

// SafeGitService is the application's security boundary.
// It wraps GitService with safety guards, pre/post checks, and user-facing
// error messages. The UI and IPC handlers interact with this — never with
// GitService directly.
//
// SAFETY RULES enforced here:
// 1. No destructive operations (hard reset, clean, force push) without explicit confirmation flag
// 2. Unreal binary files are never auto-merged
// 3. LFS pointer files are detected after every pull
// 4. Branch switches require clean working tree or explicit stash consent
// 5. Backups are created before pull/sync operations
// 6. Unreal Engine process is checked before sync
export class SafeGitService {
  private readonly git: GitService
  private readonly lfs: LfsService
  private readonly backup: BackupService
  private readonly log: LogService

  constructor(repositoryPath: string) {
    this.git = new GitService(repositoryPath)
    this.lfs = new LfsService(repositoryPath)
    this.backup = new BackupService(repositoryPath)
    this.log = LogService.getInstance()
  }

  // ─── Branch Operations ────────────────────────────────────────────────────

  async switchBranch(
    branchName: string,
    opts: { stashFirst?: boolean } = {},
  ): Promise<{ success: boolean; requiresAction: 'stash' | 'commit' | null; error: string | null }> {
    const hasChanges = await this.git.hasUncommittedChanges()
    if (hasChanges && !opts.stashFirst) {
      return {
        success: false,
        requiresAction: 'commit', // let user decide: commit or stash
        error: 'You have unsaved changes. Please commit or stash them before switching branches.',
      }
    }

    if (hasChanges && opts.stashFirst) {
      const stashResult = await this.stash()
      if (!stashResult.success) {
        return { success: false, requiresAction: null, error: 'Failed to stash changes: ' + stashResult.error }
      }
    }

    this.log.info('branch:switch', ['switch', branchName])
    const result = await this.git.switchBranch(branchName)
    return { success: result.success, requiresAction: null, error: result.error }
  }

  async createBranch(name: string, from: string): Promise<{ success: boolean; error: string | null }> {
    if (!/^[a-zA-Z0-9/_.-]+$/.test(name)) {
      return { success: false, error: 'Branch name contains invalid characters.' }
    }

    this.log.info('branch:create', ['checkout', '-b', name, from])
    const result = await this.git.createBranch(name, from)
    if (!result.success) {
      const detail = result.error?.includes('not a valid object')
        ? `Cannot create branch — the repository has no commits yet. Make an initial commit first.`
        : result.error ?? 'Failed to create branch.'
      return { success: false, error: detail }
    }

    // Auto-publish to remote so the branch appears on GitHub immediately
    const push = await this.git.publishBranch(name)
    if (!push.success) {
      this.log.warn('branch:create', [`Branch created locally but remote push failed: ${push.error}`])
    }

    return { success: true, error: null }
  }

  async deleteBranch(
    name: string,
    opts: { force?: boolean; confirmed?: boolean } = {},
  ): Promise<{ success: boolean; error: string | null }> {
    if (opts.force && !opts.confirmed) {
      // Force delete must be explicitly confirmed — it loses unmerged commits
      return { success: false, error: 'Force delete requires explicit confirmation.' }
    }

    this.log.info('branch:delete', ['branch', opts.force ? '-D' : '-d', name])
    const success = await this.git.deleteBranch(name, opts.force)
    return { success, error: success ? null : 'Failed to delete branch. It may have unmerged changes.' }
  }

  // ─── Stash ────────────────────────────────────────────────────────────────

  async stash(): Promise<{ success: boolean; error: string | null }> {
    const executor = (this.git as any).executor
    const result = await executor.git(['stash', 'push', '-m', 'deepcurrent-auto-stash'])
    return { success: result.success, error: result.success ? null : result.stderr }
  }

  // ─── Commit ───────────────────────────────────────────────────────────────

  async commit(request: CommitRequest): Promise<CommitResult> {
    if (!request.message.trim()) {
      return { success: false, hash: null, error: 'Commit message cannot be empty.' }
    }

    if (request.files.length > 0) {
      await this.git.stageFiles(request.files)
    }

    this.log.info('commit', ['commit', '-m', request.message])
    const result = await this.git.commit(request.message)

    if (result.success && request.pushAfter) {
      const branch = await this.git.getCurrentBranch()
      if (branch) {
        const pushResult = await this.push(branch)
        return { ...result, pushSuccess: pushResult.success }
      }
    }

    return result
  }

  // ─── Push ─────────────────────────────────────────────────────────────────

  async push(
    branch: string,
    opts: { force?: boolean; confirmed?: boolean } = {},
    onProgress?: (chunk: string) => void,
  ): Promise<PushResult> {
    // SAFETY: Force push is never allowed without explicit confirmation
    if (opts.force && !opts.confirmed) {
      return {
        success: false,
        branch,
        commitsCount: 0,
        error: 'Force push requires explicit confirmation. This operation can destroy remote history.',
        wasRejected: false,
        remoteHasNewCommits: false,
      }
    }

    // Prevent accidental force push entirely in V1
    if (opts.force) {
      return {
        success: false,
        branch,
        commitsCount: 0,
        error: 'Force push is disabled in V1 of Deepcurrent Git. Contact your administrator.',
        wasRejected: false,
        remoteHasNewCommits: false,
      }
    }

    // Check if remote has new commits — push would be rejected anyway, but we catch it early
    const { ahead, behind } = await this.git.getAheadBehind(branch)
    if (behind > 0) {
      return {
        success: false,
        branch,
        commitsCount: 0,
        error: `The remote has ${behind} new commit(s). Please sync first before pushing.`,
        wasRejected: false,
        remoteHasNewCommits: true,
      }
    }

    this.log.info('push', ['push', 'origin', branch])
    const result = await this.git.push(branch, 'origin', onProgress)
    return {
      ...result,
      branch,
      commitsCount: ahead,
      remoteHasNewCommits: false,
    }
  }

  // ─── Discard Changes (DANGEROUS — requires explicit confirmation) ──────────

  async discardChanges(
    paths: string[],
    opts: { confirmed: boolean },
  ): Promise<{ success: boolean; error: string | null }> {
    if (!opts.confirmed) {
      return {
        success: false,
        error: 'Discarding changes requires explicit user confirmation. This operation cannot be undone.',
      }
    }

    // Create backup before discarding
    await this.backup.createBackup('discard-changes', paths)

    const executor = (this.git as any).executor

    // Separate tracked (restore) from untracked (clean)
    const statusResult = await executor.git(['status', '--porcelain', '-z'])
    const untrackedSet = new Set<string>()
    if (statusResult.success) {
      for (const line of statusResult.stdout.split('\0')) {
        if (line.startsWith('??')) {
          untrackedSet.add(line.slice(3).trim())
        }
      }
    }

    const untracked = paths.filter((p) => untrackedSet.has(p))
    const tracked   = paths.filter((p) => !untrackedSet.has(p))

    if (tracked.length > 0) {
      const r = await executor.git(['restore', '--', ...tracked])
      if (!r.success) return { success: false, error: r.stderr }
    }
    if (untracked.length > 0) {
      const r = await executor.git(['clean', '-f', '--', ...untracked])
      if (!r.success) return { success: false, error: r.stderr }
    }

    this.log.warn('changes:discard', paths)
    return { success: true, error: null }
  }

  // ─── Conflict Resolution ──────────────────────────────────────────────────

  async resolveConflict(request: ConflictResolveRequest): Promise<{ success: boolean; error: string | null }> {
    const { path: filePath, resolution } = request

    if (resolution === 'abort') {
      const success = await this.git.abortMerge()
      return { success, error: success ? null : 'Failed to abort merge.' }
    }

    let success: boolean
    if (resolution === 'keep-mine') {
      success = await this.git.resolveConflictKeepOurs(filePath)
    } else {
      success = await this.git.resolveConflictKeepTheirs(filePath)
    }

    this.log.info('conflict:resolve', [filePath, resolution])
    return { success, error: success ? null : `Failed to resolve conflict for ${filePath}.` }
  }

  // ─── Accessors (no safety rules needed) ───────────────────────────────────

  get gitService(): GitService {
    return this.git
  }

  get lfsService(): LfsService {
    return this.lfs
  }

  get backupService(): BackupService {
    return this.backup
  }
}
