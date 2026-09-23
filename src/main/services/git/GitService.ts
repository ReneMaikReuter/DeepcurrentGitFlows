import * as fs from 'fs'
import * as path from 'path'
import { GitExecutor } from './GitExecutor'
import { UnrealDetector } from './UnrealDetector'
import type {
  Branch,
  ChangedFile,
  Conflict,
  FileStatus,
  RepositoryHealth,
} from '../../../shared/types'

// GitService: raw git operations, parsed into typed results.
// Does NOT enforce safety rules — that is SafeGitService's responsibility.
export class GitService {
  private readonly executor: GitExecutor

  constructor(private readonly repositoryPath: string) {
    this.executor = new GitExecutor(repositoryPath)
  }

  // ─── Health ───────────────────────────────────────────────────────────────

  async checkHealth(): Promise<RepositoryHealth> {
    const errors: string[] = []
    const warnings: string[] = []

    const gitVersion = await GitExecutor.checkGit()
    const lfsVersion = await GitExecutor.checkGitLfs()

    if (!gitVersion) {
      errors.push('Git is not installed or not found in PATH.')
    }

    if (!lfsVersion) {
      warnings.push('Git LFS is not installed. Large file support is unavailable.')
    }

    const isValid = await this.isValidRepository()
    if (!isValid) {
      errors.push('This directory is not a valid Git repository.')
    }

    const gitAttributesOk = await this.checkGitAttributes()
    if (!gitAttributesOk) {
      warnings.push('.gitattributes is missing or does not track Unreal assets via LFS.')
    }

    const unrealInfo = new UnrealDetector(this.repositoryPath).detectProject()

    return {
      isValid,
      gitVersion,
      lfsVersion,
      gitOk: !!gitVersion,
      lfsOk: !!lfsVersion,
      gitAttributesOk,
      isUnrealProject: unrealInfo.isUnrealProject,
      errors,
      warnings,
    }
  }

  async isValidRepository(): Promise<boolean> {
    const result = await this.executor.git(['rev-parse', '--git-dir'])
    return result.success
  }

  async getRemote(): Promise<string | null> {
    const result = await this.executor.git(['remote', 'get-url', 'origin'])
    return result.success ? result.stdout.trim() : null
  }

  private async checkGitAttributes(): Promise<boolean> {
    const attrPath = path.join(this.repositoryPath, '.gitattributes')
    if (!fs.existsSync(attrPath)) return false

    const content = await fs.promises.readFile(attrPath, 'utf8')
    // Check if at least one Unreal extension is tracked with LFS
    return /\.(uasset|umap|ubulk|uexp).*filter=lfs/.test(content)
  }

  // ─── Branches ─────────────────────────────────────────────────────────────

  async getCurrentBranch(): Promise<string | null> {
    const result = await this.executor.git(['branch', '--show-current'])
    if (!result.success || !result.stdout) return null
    return result.stdout.trim()
  }

  async listBranches(): Promise<Branch[]> {
    // --format with null-delimited fields for safe parsing
    const result = await this.executor.git([
      'branch',
      '-a',
      '--format=%(refname)|%(objectname:short)|%(subject)|%(authorname)|%(committerdate:unix)|%(upstream:short)|%(upstream:track)',
    ])
    if (!result.success) return []

    const branches: Branch[] = []
    const currentBranch = await this.getCurrentBranch()

    for (const line of result.stdout.split('\n').filter(Boolean)) {
      const [refname, hash, subject, author, dateStr, upstream, track] = line.split('|')
      if (!refname) continue

      const isRemote = refname.startsWith('refs/remotes/')
      const isLocal = refname.startsWith('refs/heads/')
      if (!isRemote && !isLocal) continue

      // Strip refs/heads/ or refs/remotes/ prefix
      const cleanName = isRemote
        ? refname.replace('refs/remotes/', '')
        : refname.replace('refs/heads/', '')

      // Parse ahead/behind from track like "[ahead 2, behind 1]"
      const aheadMatch = track?.match(/ahead (\d+)/)
      const behindMatch = track?.match(/behind (\d+)/)

      let aheadBy = aheadMatch ? parseInt(aheadMatch[1]) : 0
      let behindBy = behindMatch ? parseInt(behindMatch[1]) : 0

      // Fallback for branches without upstream tracking: try origin/<name>
      if (!isRemote && !upstream && !aheadBy) {
        const inferredUpstream = `origin/${cleanName}`
        const rev = await this.executor.git(['rev-list', '--left-right', '--count', `${inferredUpstream}...HEAD`])
        if (rev.success && rev.stdout.trim()) {
          const [behind, ahead] = rev.stdout.trim().split(/\s+/).map(Number)
          aheadBy = ahead || 0
          behindBy = behind || 0
        }
      }

      let parentBranch: string | null = null
      if (!isRemote) {
        const reflog = await this.executor.git(['reflog', 'show', cleanName, '--format=%gs', '-20'])
        if (reflog.success) {
          for (const entry of reflog.stdout.split('\n')) {
            const m = entry.match(/branch: (?:Created from|renamed from|reset:.*to) (.+)/)
            if (m) {
              const raw = m[1].trim().replace(/^origin\//, '')
              if (raw !== cleanName) { parentBranch = raw; break }
            }
          }
        }
      }

      branches.push({
        name: cleanName,
        isCurrent: cleanName === currentBranch,
        isRemote,
        upstream: upstream || null,
        aheadBy,
        behindBy,
        lastCommitHash: hash || null,
        lastCommitMessage: subject || null,
        lastCommitAuthor: author || null,
        lastCommitDate: dateStr ? parseInt(dateStr) * 1000 : null,
        parentBranch,
      })
    }

    return branches
  }

  async createBranch(name: string, from: string): Promise<{ success: boolean; error: string | null }> {
    // Check if `from` actually exists before passing it as an argument.
    // On a fresh repo (no commits yet) or when the base branch doesn't exist
    // locally, omit the `from` arg so git creates the branch from HEAD.
    const checkFrom = await this.executor.git(['rev-parse', '--verify', from])
    const args = checkFrom.success
      ? ['checkout', '-b', name, from]
      : ['checkout', '-b', name]

    const result = await this.executor.git(args)
    return { success: result.success, error: result.success ? null : result.stderr }
  }

  async publishBranch(name: string): Promise<{ success: boolean; error: string | null }> {
    const result = await this.executor.git(['push', '-u', 'origin', name])
    return { success: result.success, error: result.success ? null : result.stderr }
  }

  async switchBranch(name: string): Promise<{ success: boolean; error: string | null }> {
    const result = await this.executor.git(['switch', name])
    return {
      success: result.success,
      error: result.success ? null : result.stderr,
    }
  }

  async deleteBranch(name: string, force: boolean = false): Promise<boolean> {
    const flag = force ? '-D' : '-d'
    const result = await this.executor.git(['branch', flag, name])
    return result.success
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  async getChangedFiles(): Promise<ChangedFile[]> {
    const result = await this.executor.git(['status', '--porcelain=v1', '-u'])
    if (!result.success) return []

    const files: ChangedFile[] = []

    for (const line of result.stdout.split('\n').filter(Boolean)) {
      const staged = line[0]
      const unstaged = line[1]
      const filePart = line.slice(3)

      // Handle renames: "old -> new"
      let filePath = filePart
      let oldPath: string | null = null
      if (filePart.includes(' -> ')) {
        const parts = filePart.split(' -> ')
        oldPath = parts[0]
        filePath = parts[1]
      }

      const status = this.parseStatus(staged, unstaged)
      const isUnrealAsset = UnrealDetector.isUnrealAsset(filePath)
      const assetType = UnrealDetector.getAssetType(filePath)

      let fileSizeBytes: number | null = null
      const absPath = path.join(this.repositoryPath, filePath)
      try {
        const stat = fs.statSync(absPath)
        fileSizeBytes = stat.size
      } catch {
        // File may not exist (deleted)
      }

      files.push({
        path: filePath,
        oldPath,
        status,
        isUnrealAsset,
        assetType,
        isLfsTracked: false, // populated by LfsService
        isLfsPointer: false, // populated by LfsService
        fileSizeBytes,
        isStaged: staged !== ' ' && staged !== '?',
      })
    }

    return files
  }

  async hasUncommittedChanges(): Promise<boolean> {
    const result = await this.executor.git(['status', '--porcelain'])
    return result.success && result.stdout.trim().length > 0
  }

  async stageFiles(paths: string[]): Promise<boolean> {
    const result = await this.executor.git(['add', '--', ...paths])
    return result.success
  }

  async unstageFiles(paths: string[]): Promise<boolean> {
    const result = await this.executor.git(['restore', '--staged', '--', ...paths])
    return result.success
  }

  // ─── Commit ───────────────────────────────────────────────────────────────

  async commit(message: string): Promise<{ success: boolean; hash: string | null; error: string | null }> {
    if (!message.trim()) {
      return { success: false, hash: null, error: 'Commit message cannot be empty.' }
    }

    const result = await this.executor.git(['commit', '-m', message])
    if (!result.success) {
      return { success: false, hash: null, error: result.stderr }
    }

    // Extract commit hash from output like "[branch abc1234] message"
    const hashMatch = result.stdout.match(/\[.*? ([a-f0-9]+)\]/)
    return { success: true, hash: hashMatch ? hashMatch[1] : null, error: null }
  }

  // ─── Fetch / Pull / Push ──────────────────────────────────────────────────

  async fetch(): Promise<{ success: boolean; error: string | null }> {
    const result = await this.executor.git(['fetch', '--all', '--prune'], { timeoutMs: 60_000 })
    return { success: result.success, error: result.success ? null : result.stderr }
  }

  async pull(): Promise<{ success: boolean; conflicts: string[]; error: string | null }> {
    const result = await this.executor.git(['pull', '--no-rebase'], { timeoutMs: 120_000 })
    if (result.success) {
      return { success: true, conflicts: [], error: null }
    }

    const conflicts = this.extractConflictedFiles(result.stdout + result.stderr)
    return { success: false, conflicts, error: result.stderr }
  }

  async push(branch: string, remote: string = 'origin', onStderr?: (chunk: string) => void): Promise<{ success: boolean; wasRejected: boolean; error: string | null }> {
    const result = await this.executor.git(['push', '--progress', remote, branch], { timeoutMs: 120_000, onStderr })
    const wasRejected = !result.success && (result.stderr.includes('rejected') || result.stderr.includes('non-fast-forward'))
    return { success: result.success, wasRejected, error: result.success ? null : result.stderr }
  }

  async getAheadBehind(branch: string, remote: string = 'origin'): Promise<{ ahead: number; behind: number }> {
    const result = await this.executor.git(['rev-list', '--left-right', '--count', `${remote}/${branch}...${branch}`])
    if (!result.success) return { ahead: 0, behind: 0 }

    const parts = result.stdout.trim().split(/\s+/)
    return {
      behind: parseInt(parts[0] ?? '0'),
      ahead: parseInt(parts[1] ?? '0'),
    }
  }

  // ─── Conflicts ────────────────────────────────────────────────────────────

  async getConflicts(ourBranch: string, theirBranch: string): Promise<Conflict[]> {
    const result = await this.executor.git(['diff', '--name-only', '--diff-filter=U'])
    if (!result.success || !result.stdout.trim()) return []

    return result.stdout
      .split('\n')
      .filter(Boolean)
      .map((filePath) => ({
        path: filePath,
        isUnrealAsset: UnrealDetector.isUnrealBinaryAsset(filePath),
        ourBranch,
        theirBranch,
        // Unreal binary assets can NEVER be auto-merged
        canAutoMerge: !UnrealDetector.isUnrealBinaryAsset(filePath),
      }))
  }

  async resolveConflictKeepOurs(filePath: string): Promise<boolean> {
    const result = await this.executor.git(['checkout', '--ours', '--', filePath])
    if (!result.success) return false
    const add = await this.executor.git(['add', '--', filePath])
    return add.success
  }

  async resolveConflictKeepTheirs(filePath: string): Promise<boolean> {
    const result = await this.executor.git(['checkout', '--theirs', '--', filePath])
    if (!result.success) return false
    const add = await this.executor.git(['add', '--', filePath])
    return add.success
  }

  async abortMerge(): Promise<boolean> {
    const result = await this.executor.git(['merge', '--abort'])
    return result.success
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private parseStatus(staged: string, unstaged: string): FileStatus {
    if (staged === 'U' || unstaged === 'U' || (staged === 'A' && unstaged === 'A') || (staged === 'D' && unstaged === 'D')) {
      return 'conflicted'
    }
    if (staged === '?' && unstaged === '?') return 'untracked'
    if (staged === 'D' || unstaged === 'D') return 'deleted'
    if (staged === 'A') return 'added'
    if (staged === 'R' || unstaged === 'R') return 'renamed'
    return 'modified'
  }

  private extractConflictedFiles(output: string): string[] {
    const conflicts: string[] = []
    for (const line of output.split('\n')) {
      const match = line.match(/CONFLICT.*?: (.*?)$/)
      if (match) conflicts.push(match[1].trim())
    }
    return conflicts
  }
}
