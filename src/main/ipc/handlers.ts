import { ipcMain, dialog, BrowserWindow, safeStorage } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { IPC } from '../../shared/types'
import type { Repository, CommitRequest, ConflictResolveRequest } from '../../shared/types'
import { SettingsService } from '../services/SettingsService'
import { GitService } from '../services/git/GitService'
import { LfsService } from '../services/git/LfsService'
import { SafeGitService } from '../services/SafeGitService'
import { SyncService } from '../services/SyncService'
import { BackupService } from '../services/BackupService'
import { LogService } from '../services/LogService'
import { GitExecutor } from '../services/git/GitExecutor'
import { UnrealDetector } from '../services/git/UnrealDetector'

// Active sync services keyed by repository path (one sync per repo at a time)
const activeSyncs = new Map<string, SyncService>()

function getMainWindow(): BrowserWindow | undefined {
  return BrowserWindow.getAllWindows()[0]
}

function parseGitProgress(data: string): number | null {
  const lines = data.split(/[\r\n]/)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    const m = line.match(/(\d+)%/)
    if (!m) continue
    const pct = parseInt(m[1])
    if (line.includes('Writing objects')) return Math.min(95, Math.round(20 + pct * 0.7))
    if (line.includes('Compressing'))     return Math.min(20, Math.round(pct * 0.2))
    if (line.includes('Counting') || line.includes('Enumerating')) return Math.min(10, Math.round(pct * 0.1))
    if (line.includes('remote:'))         return Math.min(100, Math.round(90 + pct * 0.1))
  }
  return null
}

export function registerIpcHandlers(): void {
  const settings = SettingsService.getInstance()
  const log = LogService.getInstance()

  function isAllowedRepo(repoPath: string): boolean {
    return settings.get().savedRepositories.some((r) => r.path === repoPath)
  }

  function guardRepo(repoPath: string): { success: false; error: string } | null {
    if (!isAllowedRepo(repoPath)) {
      log.warn('ipc:guard', [repoPath], 'Rejected IPC call for unregistered repo path')
      return { success: false, error: 'Repository not registered.' }
    }
    return null
  }

  // ── Repository ─────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.REPO_LIST_SAVED, () => settings.get().savedRepositories)

  ipcMain.handle(IPC.REPO_OPEN, async (_e, repoPath: string) => {
    const resolvedPath = await GitExecutor.resolveRepositoryRoot(repoPath)
    if (!resolvedPath) {
      return { success: false, error: 'Not a valid Git repository.' }
    }

    const gitService = new GitService(resolvedPath)
    const health = await gitService.checkHealth()
    const remote = await gitService.getRemote()
    const unrealInfo = new UnrealDetector(resolvedPath).detectProject()

    const repo: Repository = {
      id: crypto.createHash('sha256').update(resolvedPath).digest('hex').slice(0, 16),
      name: unrealInfo.projectName ?? path.basename(resolvedPath),
      path: resolvedPath,
      remote,
      lastOpened: Date.now(),
    }

    await settings.saveRepository(repo)
    await settings.setLastOpened(repo.id)

    // Migrate legacy in-repo backups to AppData (one-time, silent)
    const backup = new BackupService(resolvedPath)
    backup.migrateOutOfRepo().catch(() => {/* silent */})

    return { success: true, repository: repo, health }
  })

  ipcMain.handle(IPC.REPO_CLONE, async (_e, url: string, targetDir: string) => {
    // Validate URL — only allow http/https/ssh/git protocols
    const urlTrimmed = url.trim()
    if (!/^(https?:\/\/|git@|git:\/\/)/.test(urlTrimmed)) {
      return { success: false, error: 'Invalid repository URL. Use https:// or git@ format.' }
    }

    // Derive repo name from URL (last path segment without .git)
    const repoName = path.basename(urlTrimmed.replace(/\.git$/, ''))
    const cloneTarget = path.join(targetDir, repoName)

    log.info('repo:clone', [urlTrimmed], cloneTarget)

    // Clone runs from targetDir, not cloneTarget (which doesn't exist yet)
    const cloneExecutor = new GitExecutor(targetDir)
    const cloneResult = await cloneExecutor.git(
      ['clone', '--progress', urlTrimmed, cloneTarget],
      { timeoutMs: 300_000 }, // 5 min for large repos
    )

    if (!cloneResult.success) {
      const errMsg = cloneResult.stderr || cloneResult.stdout || 'Clone failed.'
      log.error('repo:clone', 'CLONE_FAILED', errMsg)
      return { success: false, error: errMsg }
    }

    // Pull LFS objects if LFS is available
    const lfsCheck = await GitExecutor.checkGitLfs()
    if (lfsCheck) {
      const lfsExecutor = new GitExecutor(cloneTarget)
      await lfsExecutor.lfs(['pull'], { timeoutMs: 300_000 })
    }

    // Open the cloned repo
    const gitService = new GitService(cloneTarget)
    const health = await gitService.checkHealth()
    const remote = await gitService.getRemote()
    const unrealInfo = new UnrealDetector(cloneTarget).detectProject()

    const repo: Repository = {
      id: crypto.createHash('sha256').update(cloneTarget).digest('hex').slice(0, 16),
      name: unrealInfo.projectName ?? repoName,
      path: cloneTarget,
      remote,
      lastOpened: Date.now(),
    }

    await settings.saveRepository(repo)
    await settings.setLastOpened(repo.id)

    return { success: true, repository: repo, health, clonedPath: cloneTarget }
  })

  ipcMain.handle(IPC.REPO_GET_HEALTH, async (_e, repoPath: string) => {
    const gitService = new GitService(repoPath)
    return gitService.checkHealth()
  })

  ipcMain.handle(IPC.REPO_REMOVE_SAVED, async (_e, id: string) => {
    await settings.removeRepository(id)
    return { success: true }
  })

  // ── Status & Changes ───────────────────────────────────────────────────────

  ipcMain.handle(IPC.STATUS_GET, async (_e, repoPath: string) => {
    const guard = guardRepo(repoPath); if (guard) return guard
    const git = new GitService(repoPath)
    const lfs = new LfsService(repoPath)
    const [files, branch, health] = await Promise.all([
      git.getChangedFiles(),
      git.getCurrentBranch(),
      git.checkHealth(),
    ])
    const lfsStatus = await lfs.getStatus()

    // AutoLock: if enabled, lock any changed LFS-tracked files not yet locked
    if (settings.get().lfsAutoLock && files.length > 0) {
      const executor = new GitExecutor(repoPath)
      const locksResult = await executor.git(['lfs', 'locks', '--json']).catch(() => null)
      const lockedPaths = new Set<string>()
      if (locksResult?.success) {
        try {
          const raw = JSON.parse(locksResult.stdout)
          ;(Array.isArray(raw) ? raw : []).forEach((l: Record<string, unknown>) => {
            if (l.path) lockedPaths.add(String(l.path))
          })
        } catch { /* ignore parse errors */ }
      }
      const lfsExtensions = /\.(uasset|umap|ubulk|uexp)$/i
      for (const f of files) {
        if (lockedPaths.has(f.path)) continue
        if (!lfsExtensions.test(f.path)) continue
        const tracked = await lfs.isFileTrackedByLfs(f.path).catch(() => false)
        if (tracked) {
          executor.git(['lfs', 'lock', f.path]).catch(() => {/* silent if already locked by this user */})
        }
      }
    }

    return { files, branch, health, lfsStatus }
  })

  ipcMain.handle(IPC.CHANGES_GET, async (_e, repoPath: string) => {
    const guard = guardRepo(repoPath); if (guard) return guard
    const git = new GitService(repoPath)
    return git.getChangedFiles()
  })

  ipcMain.handle(IPC.CHANGES_STAGE, async (_e, repoPath: string, filePaths: string[]) => {
    const guard = guardRepo(repoPath); if (guard) return guard
    const git = new GitService(repoPath)
    const success = await git.stageFiles(filePaths)
    return { success }
  })

  ipcMain.handle(IPC.CHANGES_UNSTAGE, async (_e, repoPath: string, filePaths: string[]) => {
    const guard = guardRepo(repoPath); if (guard) return guard
    const git = new GitService(repoPath)
    const success = await git.unstageFiles(filePaths)
    return { success }
  })

  ipcMain.handle(IPC.CHANGES_DISCARD, async (_e, repoPath: string, filePaths: string[], confirmed: boolean) => {
    const guard = guardRepo(repoPath); if (guard) return guard
    const safe = new SafeGitService(repoPath)
    return safe.discardChanges(filePaths, { confirmed })
  })

  // ── Branches ───────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.BRANCH_LIST, async (_e, repoPath: string) => {
    const guard = guardRepo(repoPath); if (guard) return guard
    const git = new GitService(repoPath)
    return git.listBranches()
  })

  async function isUnrealRunning(): Promise<boolean> {
    return new Promise((resolve) => {
      if (process.platform !== 'win32') { resolve(false); return }
      const { spawn } = require('child_process') as typeof import('child_process')
      const child = spawn('tasklist', ['/NH'], { shell: false })
      let stdout = ''
      child.stdout?.on('data', (d: Buffer) => { stdout += d.toString() })
      child.on('close', () => {
        const lower = stdout.toLowerCase()
        resolve(lower.includes('unrealedit') || lower.includes('ue5editor') || lower.includes('ue4editor'))
      })
      child.on('error', () => resolve(false))
    })
  }

  ipcMain.handle(IPC.BRANCH_SWITCH, async (_e, repoPath: string, branchName: string, stashFirst: boolean, skipUeCheck = false) => {
    const guard = guardRepo(repoPath); if (guard) return guard
    // When UE is running, signal the renderer to confirm — don't hard-block
    if (!skipUeCheck && await isUnrealRunning()) {
      return { requiresAction: 'ue_running', success: false, error: null }
    }
    const safe = new SafeGitService(repoPath)
    return safe.switchBranch(branchName, { stashFirst })
  })

  ipcMain.handle(IPC.BRANCH_CREATE, async (_e, repoPath: string, name: string, from: string) => {
    const safe = new SafeGitService(repoPath)
    return safe.createBranch(name, from)
  })

  ipcMain.handle(IPC.BRANCH_DELETE, async (_e, repoPath: string, name: string, force: boolean, confirmed: boolean) => {
    const protectedBranches: string[] = settings.get().protectedBranches ?? []
    if (protectedBranches.includes(name)) {
      return { success: false, error: `Branch "${name}" ist geschützt und kann nicht gelöscht werden.` }
    }
    const safe = new SafeGitService(repoPath)
    return safe.deleteBranch(name, { force, confirmed })
  })

  ipcMain.handle(IPC.BRANCH_DELETE_REMOTE, async (_e, repoPath: string, remoteBranchName: string) => {
    // remoteBranchName is e.g. "origin/Rob_LVL" — strip the "origin/" prefix
    const shortName = remoteBranchName.replace(/^origin\//, '')
    const executor = new GitExecutor(repoPath)
    const result = await executor.git(['push', 'origin', '--delete', shortName])
    return { success: result.success, error: result.success ? null : (result.stderr || result.stdout || 'Fehler beim Löschen.') }
  })

  ipcMain.handle(IPC.BRANCH_PUSH, async (_e, repoPath: string, branchName: string) => {
    const win = getMainWindow()
    const safe = new SafeGitService(repoPath)
    const result = await safe.push(branchName, {}, (chunk) => {
      const pct = parseGitProgress(chunk)
      if (pct !== null) win?.webContents.send(IPC.PUSH_PROGRESS, pct)
    })
    win?.webContents.send(IPC.PUSH_PROGRESS, null)
    return result
  })

  ipcMain.handle(IPC.BRANCH_AHEAD_FILES, async (_e, repoPath: string, _branch: string, upstream: string) => {
    const executor = new GitExecutor(repoPath)
    // All files changed across all unpushed commits
    const result = await executor.git(['diff', `${upstream}...HEAD`, '--name-status'])
    if (!result.success) {
      // Fallback: no upstream yet — diff from first commit
      const fb = await executor.git(['log', 'HEAD', '--name-only', '--format='])
      const files = fb.stdout.split('\n').map((l) => l.trim()).filter(Boolean)
      return [...new Set(files)]
    }
    const files: string[] = []
    for (const raw of result.stdout.split('\n')) {
      const line = raw.replace(/\r$/, '').trim()
      if (!line) continue
      const cols = line.split('\t')
      const path = cols[cols.length - 1]
      if (path) files.push(path)
    }
    return [...new Set(files)]
  })

  ipcMain.handle(IPC.BRANCH_MERGE, async (_e, repoPath: string, sourceBranch: string) => {
    const executor = new GitExecutor(repoPath)
    try {
      const result = await executor.git(['merge', '--no-ff', sourceBranch, '-m', `Merge branch '${sourceBranch}'`])
      const alreadyUpToDate = result.stdout.includes('Already up to date') || result.stderr.includes('Already up to date')
      return { success: true, alreadyUpToDate, output: result.stdout }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const alreadyUpToDate = msg.includes('Already up to date')
      if (alreadyUpToDate) return { success: true, alreadyUpToDate: true, output: msg }
      const hasConflict = msg.includes('CONFLICT') || msg.includes('conflict')
      return { success: false, alreadyUpToDate: false, error: msg, hasConflict }
    }
  })

  // ── Commit ─────────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.COMMIT, async (_e, repoPath: string, request: CommitRequest) => {
    const guard = guardRepo(repoPath); if (guard) return guard
    const safe = new SafeGitService(repoPath)
    const result = await safe.commit(request)

    if (result.success && settings.get().lfsAutoLock && request.files.length > 0) {
      const lfs = new LfsService(repoPath)
      const executor = new GitExecutor(repoPath)
      const lfsFiles: string[] = []
      await Promise.allSettled(
        request.files.map(async (filePath) => {
          const tracked = await lfs.isFileTrackedByLfs(filePath)
          if (tracked) {
            lfsFiles.push(filePath)
            await executor.git(['lfs', 'lock', filePath])
          }
        }),
      )
      // Auto-unlock after push — lock served its purpose once the push is done
      if (request.pushAfter && result.pushSuccess && lfsFiles.length > 0) {
        await Promise.allSettled(
          lfsFiles.map((filePath) => executor.git(['lfs', 'unlock', filePath])),
        )
      }
    }

    return result
  })

  // ── Sync ───────────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.SYNC_START, async (event, repoPath: string) => {
    void event // used below for event.sender.send
    const guard = guardRepo(repoPath); if (guard) return guard
    if (activeSyncs.has(repoPath)) {
      return { success: false, error: 'A sync is already in progress for this repository.' }
    }

    const syncService = new SyncService(repoPath)
    activeSyncs.set(repoPath, syncService)

    try {
      const finalState = await syncService.runSync((state) => {
        // Push progress to renderer via event
        event.sender.send(IPC.SYNC_STATUS, repoPath, state)
      })
      return { success: finalState.phase === 'done', state: finalState }
    } finally {
      activeSyncs.delete(repoPath)
    }
  })

  ipcMain.handle(IPC.SYNC_CANCEL, (_e, repoPath: string) => {
    const sync = activeSyncs.get(repoPath)
    if (sync) {
      sync.requestAbort()
      return { success: true }
    }
    return { success: false, error: 'No active sync found.' }
  })

  // ── LFS ────────────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.LFS_STATUS, async (_e, repoPath: string) => {
    const lfs = new LfsService(repoPath)
    return lfs.getStatus()
  })

  ipcMain.handle(IPC.LFS_FETCH, async (_e, repoPath: string) => {
    const lfs = new LfsService(repoPath)
    return lfs.fetchAll()
  })

  // ── Conflicts ──────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.CONFLICT_RESOLVE, async (_e, repoPath: string, request: ConflictResolveRequest) => {
    const safe = new SafeGitService(repoPath)
    return safe.resolveConflict(request)
  })

  // ── Backups ────────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.BACKUP_CREATE, async (_e, repoPath: string, label: string) => {
    const s = settings.get()
    const backup = new BackupService(repoPath, s.backupRetentionCount ?? 10, s.backupPath || undefined)
    const result = await backup.createBackup(label || 'manual')
    log.info('backup:create', [label || 'manual'])
    return { success: true, backup: result }
  })

  ipcMain.handle(IPC.BACKUP_LIST, async (_e, repoPath: string) => {
    const s = settings.get()
    const backup = new BackupService(repoPath, s.backupRetentionCount ?? 10, s.backupPath || undefined)
    return backup.listBackups()
  })

  ipcMain.handle(IPC.BACKUP_RESTORE, async (_e, repoPath: string, backupId: string) => {
    const s = settings.get()
    const backup = new BackupService(repoPath, 10, s.backupPath || undefined)
    return backup.restoreBackup(backupId)
  })

  ipcMain.handle(IPC.BACKUP_DELETE, async (_e, repoPath: string, backupId: string) => {
    const s = settings.get()
    const backup = new BackupService(repoPath, 10, s.backupPath || undefined)
    return backup.deleteBackup(backupId)
  })

  // ── Team ───────────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.TEAM_GET, async (_e, repoPath: string) => {
    const git = new GitService(repoPath)
    const executor = new GitExecutor(repoPath)
    const branches = await git.listBranches()
    const remoteBranches = branches.filter((b) => b.isRemote && !b.name.includes('HEAD'))

    const members = await Promise.all(remoteBranches.map(async (b) => {
      const branchRef = b.name // e.g. origin/feature-x
      // Get last commit metadata + files for this branch
      const filesResult = await executor.git([
        'log', branchRef, '-1', '--format=%an\t%ae\t%ct', '--name-only',
      ])
      let name = b.lastCommitAuthor ?? b.name
      let email = ''
      let lastActivity = b.lastCommitDate
      const lastFiles: string[] = []

      if (filesResult.success) {
        const lines = filesResult.stdout.split('\n').map((l) => l.replace(/\r$/, '').trim()).filter(Boolean)
        if (lines.length > 0) {
          const meta = lines[0].split('\t')
          name = meta[0] ?? name
          email = meta[1] ?? ''
          lastActivity = meta[2] ? parseInt(meta[2]) * 1000 : lastActivity
          // remaining lines are file paths
          for (const f of lines.slice(1)) {
            if (f) lastFiles.push(f)
          }
        }
      }

      return {
        name,
        email,
        branch: b.name.replace('origin/', ''),
        changesCount: lastFiles.length || null,
        lastActivity,
        avatarUrl: null,
        lastFiles,
      }
    }))

    return members
  })

  // ── LFS Locks ──────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.LFS_LIST_LOCKS, async (_e, repoPath: string) => {
    const executor = new GitExecutor(repoPath)
    const result = await executor.git(['lfs', 'locks', '--json'])
    if (!result.success) return []
    try {
      const raw = JSON.parse(result.stdout)
      return (Array.isArray(raw) ? raw : []).map((l: Record<string, unknown>) => ({
        id: String(l.id ?? ''),
        path: String(l.path ?? ''),
        owner: typeof l.owner === 'object' && l.owner !== null ? String((l.owner as Record<string, unknown>).name ?? '') : String(l.owner ?? ''),
        lockedAt: l.locked_at ? new Date(String(l.locked_at)).getTime() : null,
      }))
    } catch { return [] }
  })

  ipcMain.handle(IPC.LFS_LOCK, async (_e, repoPath: string, filePath: string) => {
    const executor = new GitExecutor(repoPath)
    const result = await executor.git(['lfs', 'lock', filePath])
    return { success: result.success, error: result.success ? null : result.stderr }
  })

  ipcMain.handle(IPC.LFS_UNLOCK, async (_e, repoPath: string, filePath: string, force: boolean = false) => {
    const executor = new GitExecutor(repoPath)
    const args = ['lfs', 'unlock', filePath]
    if (force) args.push('--force')
    const result = await executor.git(args)
    return { success: result.success, error: result.success ? null : result.stderr }
  })

  // ── Fetch ──────────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.FETCH, async (_e, repoPath: string) => {
    const win = getMainWindow()
    const executor = new GitExecutor(repoPath)
    const result = await executor.git(['fetch', '--all', '--prune', '--progress'], {
      timeoutMs: 120_000,
      onStderr: (chunk) => {
        const pct = parseGitProgress(chunk)
        if (pct !== null) win?.webContents.send(IPC.FETCH_PROGRESS, pct)
      },
    })
    win?.webContents.send(IPC.FETCH_PROGRESS, null)
    return { success: result.success, error: result.success ? null : result.stderr }
  })

  // ── Dialog ─────────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.DIALOG_PICK_PATH, async (_e, repoPath: string) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const result = await dialog.showOpenDialog(win, {
      title: 'Datei oder Ordner auswählen',
      defaultPath: repoPath,
      properties: ['openFile', 'openDirectory', 'multiSelections'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const nodePath = await import('path')
    return result.filePaths.map((p) => {
      const rel = nodePath.relative(repoPath, p).replace(/\\/g, '/')
      return rel
    })
  })

  // ── Gitignore ──────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.GITIGNORE_GET, async (_e, repoPath: string) => {
    const fs = await import('fs')
    const nodePath = await import('path')
    const filePath = nodePath.join(repoPath, '.gitignore')
    try {
      const content = await fs.promises.readFile(filePath, 'utf8')
      return content.split('\n').map((l: string) => l.trim()).filter((l: string) => l && !l.startsWith('#'))
    } catch { return [] }
  })

  ipcMain.handle(IPC.GITIGNORE_SET, async (_e, repoPath: string, patterns: string[]) => {
    const fs = await import('fs')
    const nodePath = await import('path')
    const filePath = nodePath.join(repoPath, '.gitignore')
    try {
      let existing = ''
      try { existing = await fs.promises.readFile(filePath, 'utf8') } catch { /* new file */ }
      // Parse existing lines, keep comments and blank sections
      const lines = existing.split('\n')
      const managedMarker = '# Deepcurrent Git managed'
      const startIdx = lines.findIndex((l: string) => l.trim() === managedMarker)
      const base = startIdx >= 0 ? lines.slice(0, startIdx) : lines
      const newSection = ['', managedMarker, ...patterns, '']
      const newContent = [...base.filter((l: string, i: number) => !(i === base.length - 1 && l.trim() === '')), ...newSection].join('\n')
      await fs.promises.writeFile(filePath, newContent, 'utf8')
      return { success: true }
    } catch (e) { return { success: false, error: String(e) } }
  })

  // ── Settings ───────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.SETTINGS_GET, () => {
    const s = settings.get()
    // Never expose the encrypted token blob to the renderer
    const { githubTokenEncrypted: _token, ...safe } = s as unknown as Record<string, unknown>
    void _token
    return safe
  })

  const SETTINGS_ALLOWED_KEYS = new Set([
    'theme', 'language', 'fontSize', 'defaultBranch',
    'protectedBranches', 'backupRetentionCount', 'backupAutoDelete', 'lfsAutoLock',
    'termsAccepted', 'lastSeenVersion', 'backupPath',
  ])

  ipcMain.handle(IPC.SETTINGS_SET, async (_e, patch: Partial<import('../../shared/types').AppSettings>) => {
    const filtered: Record<string, unknown> = {}
    for (const key of Object.keys(patch as object)) {
      if (SETTINGS_ALLOWED_KEYS.has(key)) {
        filtered[key] = (patch as Record<string, unknown>)[key]
      }
    }
    return settings.patch(filtered as Partial<import('../../shared/types').AppSettings>)
  })

  // ── Unreal ─────────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.UNREAL_IS_RUNNING, () => isUnrealRunning())

  // ── Logs ───────────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.LOG_GET, (_e, count: number = 100) => {
    return log.getRecentEntries(count)
  })

  // ── History ────────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.HISTORY_GET, async (_e, repoPath: string, limit: number = 60) => {
    const guard = guardRepo(repoPath); if (guard) return guard
    const executor = new GitExecutor(repoPath)

    // Commits reachable from any remote ref (= already pushed)
    const remoteResult = await executor.git(['log', '--remotes', '--format=%H'])
    const remoteHashes = new Set(
      remoteResult.stdout.split('\n').map((h) => h.trim()).filter(Boolean),
    )

    // Branch refs per commit hash (from --decorate)
    const decorateResult = await executor.git([
      'log', `--max-count=${limit}`, '--format=%H\t%D',
    ])
    const branchMap = new Map<string, string[]>()
    if (decorateResult.success) {
      for (const raw of decorateResult.stdout.split('\n')) {
        const line = raw.replace(/\r$/, '').trim()
        if (!line) continue
        const tab = line.indexOf('\t')
        if (tab < 0) continue
        const h = line.slice(0, tab).trim()
        const refs = line.slice(tab + 1).split(',').map((r) => r.trim()).filter(Boolean)
        // Keep only branch names (strip "HEAD -> ", "origin/", etc.)
        const branchNames = refs
          .map((r) => r.replace(/^HEAD -> /, ''))
          .filter((r) => !r.startsWith('tag:'))
        if (branchNames.length > 0) branchMap.set(h, branchNames)
      }
    }

    // Two-pass approach: first get commit metadata, then file lists per commit
    // This avoids null-byte or special-char issues in format strings on Windows.
    const metaResult = await executor.git([
      'log',
      `--max-count=${limit}`,
      '--format=%H\t%h\t%an\t%ae\t%ct\t%s',
    ])
    if (!metaResult.success) return []

    const commits: any[] = []
    for (const raw of metaResult.stdout.split('\n')) {
      const line = raw.replace(/\r$/, '')
      if (!line.trim()) continue
      const cols = line.split('\t')
      const [hash, shortHash, author, email, ctStr, ...msgParts] = cols
      if (!hash?.trim()) continue
      commits.push({
        hash: hash.trim(),
        shortHash: (shortHash ?? '').trim(),
        author: (author ?? '').trim(),
        email: (email ?? '').trim(),
        date: parseInt((ctStr ?? '0').trim()) * 1000,
        message: msgParts.join('\t').trim(),
        files: [],
        pushedToRemote: remoteHashes.has(hash.trim()),
        branches: branchMap.get(hash.trim()) ?? [],
      })
    }

    // Fetch file lists for all commits in one call
    const hashList = commits.map((c) => c.hash)
    if (hashList.length > 0) {
      const fileResult = await executor.git([
        'log',
        `--max-count=${limit}`,
        '-m', '--first-parent',
        '--format=HASH:%H',
        '--name-status',
      ])
      if (fileResult.success) {
        let idx = -1
        for (const raw of fileResult.stdout.split('\n')) {
          const line = raw.replace(/\r$/, '')
          if (line.startsWith('HASH:')) {
            const h = line.slice(5).trim()
            idx = commits.findIndex((c) => c.hash === h)
          } else if (idx >= 0 && line.trim()) {
            const cols = line.split('\t').map((c) => c.trim())
            const rawStatus = (cols[0] ?? '')[0] ?? 'M'
            const status = (['A', 'M', 'D', 'R'].includes(rawStatus) ? rawStatus : 'M') as 'A' | 'M' | 'D' | 'R'
            if (status === 'R') {
              commits[idx].files.push({ path: cols[2] ?? cols[1] ?? '', status, oldPath: cols[1] })
            } else if (cols[1]) {
              commits[idx].files.push({ path: cols[1], status })
            }
          }
        }
      }
    }

    return commits
  })

  ipcMain.handle(IPC.HISTORY_RESTORE_FILES, async (
    _e, repoPath: string, commitHash: string,
    filePaths: string[], fileStatuses?: Record<string, string>
  ) => {
    const guard = guardRepo(repoPath); if (guard) return guard
    const executor = new GitExecutor(repoPath)
    const results: { path: string; success: boolean; error?: string }[] = []
    for (const filePath of filePaths) {
      const status = fileStatuses?.[filePath] ?? ''
      if (status === 'A') {
        // File was added in this commit — parent doesn't have it, just delete from disk
        const absPath = path.join(repoPath, filePath)
        try {
          await fs.promises.rm(absPath, { force: true })
          results.push({ path: filePath, success: true })
        } catch (e) {
          results.push({ path: filePath, success: false, error: String(e) })
        }
      } else {
        const res = await executor.git(['restore', `--source=${commitHash}~1`, '--', filePath])
        results.push({ path: filePath, success: res.success, error: res.success ? undefined : res.stderr })
      }
    }
    const allOk = results.every((r) => r.success)
    log.info('history:restore', filePaths, commitHash)
    return { success: allOk, results }
  })

  ipcMain.handle(IPC.HISTORY_UNDO_COMMIT, async (_e, repoPath: string, commitHash: string) => {
    const guard = guardRepo(repoPath); if (guard) return guard
    const executor = new GitExecutor(repoPath)
    // Soft-reset to the parent of the given commit, keeping all changes unstaged
    const result = await executor.git(['reset', '--soft', `${commitHash}~1`])
    if (!result.success) return { success: false, error: result.stderr }
    log.warn('history:undo-commit', ['reset', '--soft', `${commitHash}~1`])
    return { success: true }
  })

  ipcMain.handle(IPC.HISTORY_REVERT_COMMIT, async (_e, repoPath: string, commitHash: string) => {
    const guard = guardRepo(repoPath); if (guard) return guard
    const executor = new GitExecutor(repoPath)
    const result = await executor.git(['revert', '--no-edit', commitHash])
    if (!result.success) return { success: false, error: result.stderr }
    log.warn('history:revert-commit', ['revert', '--no-edit', commitHash])
    return { success: true }
  })

  ipcMain.handle(IPC.HISTORY_UNDO_ALL_UNPUSHED, async (_e, repoPath: string, branchName: string) => {
    const guard = guardRepo(repoPath); if (guard) return guard
    const executor = new GitExecutor(repoPath)
    // Reset to the remote tracking branch, landing all unpushed changes in the working tree
    const result = await executor.git(['reset', '--soft', `origin/${branchName}`])
    if (!result.success) return { success: false, error: result.stderr }
    log.warn('history:undo-all-unpushed', ['reset', '--soft', `origin/${branchName}`])
    return { success: true }
  })

  // ── Remote ─────────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.REMOTE_REMOVE, async (_e, repoPath: string) => {
    const executor = new GitExecutor(repoPath)
    await executor.git(['remote', 'remove', 'origin'])
    const savedRepos = settings.get().savedRepositories
    const existing = savedRepos.find((r) => r.path === repoPath)
    if (existing) await settings.saveRepository({ ...existing, remote: null })
    log.info('remote:remove', ['remote', 'remove', 'origin'])
    return { success: true }
  })

  ipcMain.handle(IPC.REMOTE_ADD, async (_e, repoPath: string, url: string) => {
    const urlTrimmed = url.trim()
    if (!/^(https?:\/\/|git@|git:\/\/)/.test(urlTrimmed)) {
      return { success: false, error: 'Invalid URL. Use https:// or git@ format.' }
    }
    const executor = new GitExecutor(repoPath)
    // Remove existing origin if any, then add fresh
    await executor.git(['remote', 'remove', 'origin'])
    const result = await executor.git(['remote', 'add', 'origin', urlTrimmed])
    if (!result.success) return { success: false, error: result.stderr }
    log.info('remote:add', [urlTrimmed])

    // Update saved repo with the new remote
    const savedRepos = settings.get().savedRepositories
    const existing = savedRepos.find((r) => r.path === repoPath)
    if (existing) await settings.saveRepository({ ...existing, remote: urlTrimmed })

    return { success: true }
  })

  ipcMain.handle(IPC.REMOTE_CREATE_GITHUB, async (_e, repoPath: string, repoName: string, isPrivate: boolean) => {
    const token = getDecryptedToken()
    if (!token) return { success: false, error: 'Nicht mit GitHub angemeldet.' }
    // Call GitHub API to create the repo
    const apiRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Deepcurrent-Git/1.0',
      },
      body: JSON.stringify({ name: repoName, private: isPrivate, auto_init: false }),
    })

    if (!apiRes.ok) {
      const body = await apiRes.json().catch(() => ({})) as any
      const msg = body?.message ?? `GitHub API error: ${apiRes.status}`
      return { success: false, error: msg }
    }

    const created = await apiRes.json() as any
    const cloneUrl: string = created.clone_url ?? created.ssh_url
    log.info('remote:create-github', [repoName, cloneUrl])

    // Wire up as origin
    const executor = new GitExecutor(repoPath)
    await executor.git(['remote', 'remove', 'origin'])
    const addResult = await executor.git(['remote', 'add', 'origin', cloneUrl])
    if (!addResult.success) return { success: false, error: addResult.stderr }

    // Update saved repo
    const savedRepos = settings.get().savedRepositories
    const existing = savedRepos.find((r) => r.path === repoPath)
    if (existing) await settings.saveRepository({ ...existing, remote: cloneUrl })

    return { success: true, repoUrl: created.html_url, cloneUrl }
  })

  ipcMain.handle(IPC.REMOTE_PUSH_INITIAL, async (_e, repoPath: string, branch: string) => {
    const executor = new GitExecutor(repoPath)
    const result = await executor.git(['push', '-u', 'origin', branch], { timeoutMs: 120_000 })
    if (!result.success) return { success: false, error: result.stderr || result.stdout }
    log.info('remote:push-initial', [branch])
    return { success: true }
  })

  // ── GitHub Device Flow ──────────────────────────────────────────────────────

  const GITHUB_CLIENT_ID = 'Ov23liFZSktw0IxKQUKQ'

  // Token is never stored plain-text. We use Electron safeStorage (Windows DPAPI /
  // macOS Keychain / Linux Secret Service) to encrypt at rest.
  function encryptToken(token: string): string {
    if (safeStorage.isEncryptionAvailable()) {
      return 'safe:' + safeStorage.encryptString(token).toString('base64')
    }
    // safeStorage unavailable (headless Linux without keyring) — prefix marks it
    // so a future migration can recognise and re-encrypt it once keyring is available
    return 'plain:' + Buffer.from(token, 'utf8').toString('base64')
  }

  function getDecryptedToken(): string | null {
    const stored = settings.get().githubTokenEncrypted
    if (!stored) return null
    try {
      if (stored.startsWith('safe:')) {
        const buf = Buffer.from(stored.slice(5), 'base64')
        return safeStorage.decryptString(buf)
      }
      if (stored.startsWith('plain:')) {
        return Buffer.from(stored.slice(6), 'base64').toString('utf8')
      }
      // Legacy plain-text token — re-encrypt immediately and persist
      const token = stored
      void settings.patch({ githubTokenEncrypted: encryptToken(token) })
      return token
    } catch {
      return null
    }
  }

  ipcMain.handle(IPC.GITHUB_DEVICE_START, async () => {
    const res = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Deepcurrent-Git-Flows/1.0',
      },
      body: new URLSearchParams({ client_id: GITHUB_CLIENT_ID, scope: 'repo read:user' }).toString(),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { success: false, error: `GitHub ${res.status}: ${body}` }
    }
    const data = await res.json() as any
    // GitHub can return 200 but with an error field (e.g. bad client_id)
    if (data.error) return { success: false, error: `GitHub: ${data.error}. ${data.error_description ?? ''}` }
    return {
      success: true,
      device_code: data.device_code,
      user_code: data.user_code,
      verification_uri: data.verification_uri,
      expires_in: data.expires_in,
      interval: data.interval ?? 5,
    }
  })

  ipcMain.handle(IPC.GITHUB_DEVICE_POLL, async (_e, deviceCode: string) => {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Deepcurrent-Git-Flows/1.0',
      },
      body: new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }).toString(),
    })
    const data = await res.json() as any
    if (data.access_token) {
      await settings.patch({ githubTokenEncrypted: encryptToken(data.access_token) })
      return { status: 'authorized' }
    }
    if (data.error === 'authorization_pending') return { status: 'pending' }
    if (data.error === 'expired_token') return { status: 'expired' }
    if (data.error === 'access_denied') return { status: 'denied' }
    return { status: 'error', error: data.error_description ?? data.error }
  })

  ipcMain.handle(IPC.GITHUB_CLEAR_TOKEN, async () => {
    await settings.patch({ githubTokenEncrypted: null })
    return { success: true }
  })

  ipcMain.handle(IPC.GITHUB_GET_USER, async () => {
    const token = getDecryptedToken()
    if (!token) return null
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Deepcurrent-Git-Flows/1.0',
      },
    })
    if (!res.ok) return null
    const data = await res.json() as any
    return { login: data.login, name: data.name, avatar_url: data.avatar_url }
  })

  ipcMain.handle(IPC.GITHUB_LIST_REPOS, async () => {
    const token = getDecryptedToken()
    if (!token) return { success: false, error: 'Not logged in.', repos: [] }
    const repos: any[] = []
    let page = 1
    while (true) {
      const res = await fetch(`https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Deepcurrent-Git-Flows/1.0',
        },
      })
      if (!res.ok) return { success: false, error: `GitHub API error: ${res.status}`, repos: [] }
      const batch = await res.json() as any[]
      repos.push(...batch)
      if (batch.length < 100) break
      page++
    }
    return {
      success: true,
      repos: repos.map((r) => ({
        id: r.id,
        name: r.name,
        full_name: r.full_name,
        clone_url: r.clone_url,
        ssh_url: r.ssh_url,
        description: r.description,
        private: r.private,
        updated_at: r.updated_at,
        language: r.language,
      })),
    }
  })
}
