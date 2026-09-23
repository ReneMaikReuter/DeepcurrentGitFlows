import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock GitExecutor to isolate GitService parsing logic
vi.mock('../../src/main/services/git/GitExecutor', () => ({
  GitExecutor: vi.fn().mockImplementation(() => ({
    git: vi.fn(),
    lfs: vi.fn(),
  })),
  GitExecutionError: class GitExecutionError extends Error {},
}))

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
    statSync: vi.fn().mockReturnValue({ size: 1024 * 100 }),
  }
})

import { GitService } from '../../src/main/services/git/GitService'

function makeService() {
  const svc = new GitService('/fake/repo')
  const executor = (svc as any).executor
  return { svc, executor }
}

describe('GitService — output parsing', () => {
  describe('getChangedFiles', () => {
    it('parses modified file', async () => {
      const { svc, executor } = makeService()
      executor.git.mockResolvedValue({ success: true, stdout: ' M Content/Hero.uasset', stderr: '', exitCode: 0, command: [], durationMs: 0 })

      const files = await svc.getChangedFiles()
      expect(files).toHaveLength(1)
      expect(files[0].status).toBe('modified')
      expect(files[0].path).toBe('Content/Hero.uasset')
      expect(files[0].isUnrealAsset).toBe(true)
      expect(files[0].assetType).toBe('uasset')
    })

    it('parses added file', async () => {
      const { svc, executor } = makeService()
      executor.git.mockResolvedValue({ success: true, stdout: 'A  Source/NewClass.cpp', stderr: '', exitCode: 0, command: [], durationMs: 0 })

      const files = await svc.getChangedFiles()
      expect(files[0].status).toBe('added')
      expect(files[0].isUnrealAsset).toBe(false)
    })

    it('parses deleted file', async () => {
      const { svc, executor } = makeService()
      executor.git.mockResolvedValue({ success: true, stdout: ' D Content/OldAsset.uasset', stderr: '', exitCode: 0, command: [], durationMs: 0 })

      const files = await svc.getChangedFiles()
      expect(files[0].status).toBe('deleted')
    })

    it('parses renamed file', async () => {
      const { svc, executor } = makeService()
      executor.git.mockResolvedValue({ success: true, stdout: 'R  Content/OldName.uasset -> Content/NewName.uasset', stderr: '', exitCode: 0, command: [], durationMs: 0 })

      const files = await svc.getChangedFiles()
      expect(files[0].status).toBe('renamed')
      expect(files[0].oldPath).toBe('Content/OldName.uasset')
      expect(files[0].path).toBe('Content/NewName.uasset')
    })

    it('parses conflicted file', async () => {
      const { svc, executor } = makeService()
      executor.git.mockResolvedValue({ success: true, stdout: 'UU Content/Hero.uasset', stderr: '', exitCode: 0, command: [], durationMs: 0 })

      const files = await svc.getChangedFiles()
      expect(files[0].status).toBe('conflicted')
    })

    it('parses untracked file', async () => {
      const { svc, executor } = makeService()
      executor.git.mockResolvedValue({ success: true, stdout: '?? NewFile.txt', stderr: '', exitCode: 0, command: [], durationMs: 0 })

      const files = await svc.getChangedFiles()
      expect(files[0].status).toBe('untracked')
    })

    it('returns empty array when git fails', async () => {
      const { svc, executor } = makeService()
      executor.git.mockResolvedValue({ success: false, stdout: '', stderr: 'fatal', exitCode: 128, command: [], durationMs: 0 })

      const files = await svc.getChangedFiles()
      expect(files).toHaveLength(0)
    })
  })

  describe('getAheadBehind', () => {
    it('parses ahead/behind counts', async () => {
      const { svc, executor } = makeService()
      executor.git.mockResolvedValue({ success: true, stdout: '2\t5', stderr: '', exitCode: 0, command: [], durationMs: 0 })

      const result = await svc.getAheadBehind('development')
      expect(result.behind).toBe(2)
      expect(result.ahead).toBe(5)
    })

    it('returns 0/0 when command fails', async () => {
      const { svc, executor } = makeService()
      executor.git.mockResolvedValue({ success: false, stdout: '', stderr: '', exitCode: 128, command: [], durationMs: 0 })

      const result = await svc.getAheadBehind('development')
      expect(result.ahead).toBe(0)
      expect(result.behind).toBe(0)
    })
  })

  // Scenario 17: empty commit message blocked
  describe('commit', () => {
    it('rejects empty commit message', async () => {
      const { svc } = makeService()
      const result = await svc.commit('')
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/empty/)
    })

    it('rejects whitespace-only message', async () => {
      const { svc } = makeService()
      const result = await svc.commit('   ')
      expect(result.success).toBe(false)
    })
  })

  // Scenario 19: force push detection
  describe('push', () => {
    it('detects rejected push', async () => {
      const { svc, executor } = makeService()
      executor.git.mockResolvedValue({
        success: false, stdout: '', stderr: '! [rejected] development -> development (non-fast-forward)',
        exitCode: 1, command: [], durationMs: 0,
      })

      const result = await svc.push('development')
      expect(result.success).toBe(false)
      expect(result.wasRejected).toBe(true)
    })
  })
})
