import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the underlying GitService to isolate SafeGitService safety logic
vi.mock('../../src/main/services/git/GitService', () => ({
  GitService: vi.fn().mockImplementation(() => ({
    hasUncommittedChanges: vi.fn().mockResolvedValue(false),
    switchBranch: vi.fn().mockResolvedValue({ success: true, error: null }),
    createBranch: vi.fn().mockResolvedValue({ success: true, error: null }),
    deleteBranch: vi.fn().mockResolvedValue(true),
    commit: vi.fn().mockResolvedValue({ success: true, hash: 'abc123', error: null }),
    push: vi.fn().mockResolvedValue({ success: true, wasRejected: false, error: null }),
    stageFiles: vi.fn().mockResolvedValue(true),
    getAheadBehind: vi.fn().mockResolvedValue({ ahead: 0, behind: 0 }),
    getCurrentBranch: vi.fn().mockResolvedValue('main'),
    resolveConflictKeepOurs: vi.fn().mockResolvedValue(true),
    resolveConflictKeepTheirs: vi.fn().mockResolvedValue(true),
    abortMerge: vi.fn().mockResolvedValue(true),
  })),
}))

vi.mock('../../src/main/services/git/LfsService', () => ({
  LfsService: vi.fn().mockImplementation(() => ({})),
}))

vi.mock('../../src/main/services/BackupService', () => ({
  BackupService: vi.fn().mockImplementation(() => ({
    createBackup: vi.fn().mockResolvedValue({ path: '/backup', fileCount: 5 }),
  })),
}))

vi.mock('../../src/main/services/LogService', () => ({
  LogService: {
    getInstance: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}))

import { SafeGitService } from '../../src/main/services/SafeGitService'

describe('SafeGitService — Safety Rules', () => {
  let safe: SafeGitService

  beforeEach(() => {
    safe = new SafeGitService('/fake/repo')
  })

  // ── Branch switch safety ──────────────────────────────────────────────────

  it('blocks branch switch when there are uncommitted changes (no stash consent)', async () => {
    const mockGit = (safe as any).git
    mockGit.hasUncommittedChanges.mockResolvedValue(true)

    const result = await safe.switchBranch('feature/test')
    expect(result.success).toBe(false)
    expect(result.requiresAction).toBe('commit')
  })

  it('allows branch switch when there are no uncommitted changes', async () => {
    const result = await safe.switchBranch('feature/test')
    expect(result.success).toBe(true)
    expect(result.requiresAction).toBeNull()
  })

  // ── Branch name validation ────────────────────────────────────────────────

  it('rejects branch names with invalid characters', async () => {
    const result = await safe.createBranch('feature/<bad>name', 'main')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/invalid characters/)
  })

  it('accepts valid branch names', async () => {
    const result = await safe.createBranch('feature/character-system', 'main')
    expect(result.success).toBe(true)
  })

  // ── Force delete protection ───────────────────────────────────────────────

  it('blocks force delete without confirmation', async () => {
    const result = await safe.deleteBranch('feature/old', { force: true, confirmed: false })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/confirmation/)
  })

  // ── Force push protection (V1: always blocked) ────────────────────────────

  it('blocks force push always in V1', async () => {
    const result = await safe.push('main', { force: true, confirmed: true })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/disabled/)
  })

  it('blocks push when remote has new commits', async () => {
    const mockGit = (safe as any).git
    mockGit.getAheadBehind.mockResolvedValue({ ahead: 1, behind: 2 })

    const result = await safe.push('main')
    expect(result.success).toBe(false)
    expect(result.remoteHasNewCommits).toBe(true)
    expect(result.error).toMatch(/sync first/)
  })

  // ── Empty commit message ──────────────────────────────────────────────────

  it('blocks commits with empty message', async () => {
    const result = await safe.commit({ message: '   ', files: [], pushAfter: false })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/empty/)
  })

  it('blocks commits with whitespace-only message', async () => {
    const result = await safe.commit({ message: '\n\t', files: [], pushAfter: false })
    expect(result.success).toBe(false)
  })

  // ── Discard changes protection ────────────────────────────────────────────

  it('blocks discarding changes without confirmation', async () => {
    const result = await safe.discardChanges(['Content/Hero.uasset'], { confirmed: false })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/confirmation/)
  })

  // ── Conflict resolution ───────────────────────────────────────────────────

  it('resolves conflict by keeping ours', async () => {
    const result = await safe.resolveConflict({ path: 'Content/Hero.uasset', resolution: 'keep-mine' })
    const mockGit = (safe as any).git
    expect(mockGit.resolveConflictKeepOurs).toHaveBeenCalledWith('Content/Hero.uasset')
    expect(result.success).toBe(true)
  })

  it('aborts merge on abort resolution', async () => {
    const result = await safe.resolveConflict({ path: 'Content/Hero.uasset', resolution: 'abort' })
    const mockGit = (safe as any).git
    expect(mockGit.abortMerge).toHaveBeenCalled()
    expect(result.success).toBe(true)
  })
})
