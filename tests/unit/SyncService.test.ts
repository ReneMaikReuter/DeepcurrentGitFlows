import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all service dependencies
vi.mock('../../src/main/services/git/GitService', () => ({
  GitService: vi.fn().mockImplementation(() => ({
    isValidRepository: vi.fn().mockResolvedValue(true),
    getCurrentBranch: vi.fn().mockResolvedValue('development'),
    fetch: vi.fn().mockResolvedValue({ success: true, error: null }),
    getAheadBehind: vi.fn().mockResolvedValue({ ahead: 0, behind: 3 }),
    pull: vi.fn().mockResolvedValue({ success: true, conflicts: [], error: null }),
    getConflicts: vi.fn().mockResolvedValue([]),
  })),
}))

vi.mock('../../src/main/services/git/LfsService', () => ({
  LfsService: vi.fn().mockImplementation(() => ({
    getStatus: vi.fn().mockResolvedValue({
      isInstalled: true,
      isInitialized: true,
      trackedPatterns: ['*.uasset', '*.umap'],
      pointerFiles: [],
      missingObjects: [],
      errors: [],
    }),
    scanForPointerFiles: vi.fn().mockResolvedValue([]),
    fetchAndRestorePointers: vi.fn().mockResolvedValue([]),
  })),
}))

vi.mock('../../src/main/services/BackupService', () => ({
  BackupService: vi.fn().mockImplementation(() => ({
    createBackup: vi.fn().mockResolvedValue({ path: '/backup/2026-09-22', fileCount: 12 }),
  })),
}))

vi.mock('../../src/main/services/LogService', () => ({
  LogService: {
    getInstance: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  },
}))

// Mock OS and exec to control Unreal Engine detection
vi.mock('os', () => ({ platform: () => 'win32' }))
vi.mock('util', () => ({ promisify: (fn: any) => fn }))
vi.mock('child_process', () => ({
  exec: (_cmd: string, cb: (err: null, result: { stdout: string }) => void) => {
    cb(null, { stdout: 'No tasks are running which match the specified criteria.' })
  },
  spawn: vi.fn(),
}))

import { SyncService } from '../../src/main/services/SyncService'

function makeSyncService() {
  return new SyncService('/fake/unreal-project')
}

describe('SyncService — safety scenarios', () => {
  // Scenario 1: Happy path — clean sync
  it('scenario 1: completes successfully when everything is clean', async () => {
    const svc = makeSyncService()
    const states: any[] = []
    const final = await svc.runSync((s) => states.push(s))

    expect(final.phase).toBe('done')
    expect(final.error).toBeNull()
    expect(final.backupPath).toBe('/backup/2026-09-22')
  })

  // Scenario 2: No changes from remote — pull is skipped
  it('scenario 2: skips pull when already up to date', async () => {
    const svc = makeSyncService()
    const git = (svc as any).git
    git.getAheadBehind.mockResolvedValue({ ahead: 0, behind: 0 })

    const final = await svc.runSync(() => {})
    expect(final.phase).toBe('done')
    const pullStep = final.steps.find((s: any) => s.id === 'pull')
    expect(pullStep?.status).toBe('skipped')
  })

  // Scenario 3: Git LFS not installed → sync blocked
  it('scenario 3: blocks sync when LFS is not installed', async () => {
    const svc = makeSyncService()
    const lfs = (svc as any).lfs
    lfs.getStatus.mockResolvedValue({
      isInstalled: false, isInitialized: false, trackedPatterns: [],
      pointerFiles: [], missingObjects: [], errors: ['Git LFS is not installed.'],
    })

    const final = await svc.runSync(() => {})
    expect(final.phase).toBe('failed')
    expect(final.error?.code).toBe('LFS_NOT_FOUND')
  })

  // Scenario 4: Network error during fetch
  it('scenario 4: reports NETWORK_ERROR when fetch fails', async () => {
    const svc = makeSyncService()
    ;(svc as any).git.fetch.mockResolvedValue({ success: false, error: 'Connection refused' })

    const final = await svc.runSync(() => {})
    expect(final.phase).toBe('failed')
    expect(final.error?.code).toBe('NETWORK_ERROR')
  })

  // Scenario 5: Corrupt repository
  it('scenario 5: fails immediately when repository is invalid', async () => {
    const svc = makeSyncService()
    ;(svc as any).git.isValidRepository.mockResolvedValue(false)

    const final = await svc.runSync(() => {})
    expect(final.phase).toBe('failed')
    expect(final.error?.code).toBe('CORRUPT_REPOSITORY')
  })

  // Scenario 6: Pull with text-file conflict (not Unreal)
  it('scenario 6: reports conflict when pull has merge conflicts', async () => {
    const svc = makeSyncService()
    ;(svc as any).git.pull.mockResolvedValue({
      success: false,
      conflicts: ['Source/MyGame/Combat.cpp'],
      error: 'Automatic merge failed',
    })
    ;(svc as any).git.getConflicts.mockResolvedValue([
      { path: 'Source/MyGame/Combat.cpp', isUnrealAsset: false, ourBranch: 'development', theirBranch: 'origin/development', canAutoMerge: true },
    ])

    const final = await svc.runSync(() => {})
    expect(final.phase).toBe('failed')
    expect(final.conflicts.length).toBeGreaterThan(0)
  })

  // Scenario 7: Unreal .uasset conflict — NEVER auto-merged
  it('scenario 7: blocks with UNREAL_CONFLICT for .uasset conflicts', async () => {
    const svc = makeSyncService()
    ;(svc as any).git.pull.mockResolvedValue({
      success: false,
      conflicts: ['Content/Characters/Hero.uasset'],
      error: 'Automatic merge failed',
    })
    ;(svc as any).git.getConflicts.mockResolvedValue([
      { path: 'Content/Characters/Hero.uasset', isUnrealAsset: true, ourBranch: 'development', theirBranch: 'origin/development', canAutoMerge: false },
    ])

    const final = await svc.runSync(() => {})
    expect(final.phase).toBe('failed')
    expect(final.error?.code).toBe('UNREAL_CONFLICT')
    expect(final.error?.affectedFiles).toContain('Content/Characters/Hero.uasset')
    // Backup must have been created before the pull attempt
    expect(final.backupPath).not.toBeNull()
  })

  // Scenario 8: .umap conflict — same protection as .uasset
  it('scenario 8: blocks with UNREAL_CONFLICT for .umap conflicts', async () => {
    const svc = makeSyncService()
    ;(svc as any).git.pull.mockResolvedValue({
      success: false, conflicts: ['Content/Maps/MainLevel.umap'], error: 'merge failed',
    })
    ;(svc as any).git.getConflicts.mockResolvedValue([
      { path: 'Content/Maps/MainLevel.umap', isUnrealAsset: true, ourBranch: 'development', theirBranch: 'origin/development', canAutoMerge: false },
    ])

    const final = await svc.runSync(() => {})
    expect(final.error?.code).toBe('UNREAL_CONFLICT')
    expect(final.error?.affectedFiles[0]).toMatch(/\.umap$/)
  })

  // Scenario 9: LFS pointer detected after pull — CRITICAL safety check
  it('scenario 9: fails with LFS_POINTER_DETECTED when pointer files remain after pull', async () => {
    const svc = makeSyncService()
    const lfs = (svc as any).lfs

    const pointerFile = {
      path: 'Content/Characters/Hero.uasset',
      oid: 'a'.repeat(64),
      expectedSizeBytes: 8_847_360,
      actualSizeBytes: 133,
      isRestored: false,
    }

    // First scan (after pull) finds pointers
    lfs.scanForPointerFiles.mockResolvedValue([pointerFile])
    // Auto-restore attempt fails — file is still a pointer
    lfs.fetchAndRestorePointers.mockResolvedValue([]) // nothing restored

    const final = await svc.runSync(() => {})
    expect(final.phase).toBe('failed')
    expect(final.error?.code).toBe('LFS_POINTER_DETECTED')
    expect(final.lfsProblems).toHaveLength(1)
    expect(final.lfsProblems[0].path).toBe('Content/Characters/Hero.uasset')
    // MUST have a backup so user can restore
    expect(final.error?.canRestore).toBe(true)
  })

  // Scenario 10: LFS pointer auto-recovered
  it('scenario 10: succeeds when LFS pointer is auto-recovered', async () => {
    const svc = makeSyncService()
    const lfs = (svc as any).lfs

    const pointerFile = {
      path: 'Content/Characters/Hero.uasset',
      oid: 'a'.repeat(64), expectedSizeBytes: 8_847_360, actualSizeBytes: 133, isRestored: false,
    }

    // First scan finds pointer
    lfs.scanForPointerFiles
      .mockResolvedValueOnce([pointerFile])  // after pull
      .mockResolvedValueOnce([])              // after auto-fetch (integrity check)
    // Restore succeeds
    lfs.fetchAndRestorePointers.mockResolvedValue(['Content/Characters/Hero.uasset'])

    const final = await svc.runSync(() => {})
    expect(final.phase).toBe('done')
    expect(final.lfsProblems).toHaveLength(0)
  })

  // Scenario 11: Backup creation fails — sync must abort
  it('scenario 11: aborts sync when backup creation fails', async () => {
    const svc = makeSyncService()
    ;(svc as any).backup.createBackup.mockRejectedValue(new Error('Disk full'))

    const final = await svc.runSync(() => {})
    expect(final.phase).toBe('failed')
    expect(final.error?.code).toBe('BACKUP_FAILED')
  })

  // Scenario 12: Sync can be cancelled mid-flight
  it('scenario 12: respects abort request between steps', async () => {
    const svc = makeSyncService()

    // Slow the fetch to give time to cancel
    ;(svc as any).git.fetch.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, error: null }), 50)),
    )

    const syncPromise = svc.runSync(() => {})
    // Request abort right after starting
    setTimeout(() => svc.requestAbort(), 10)
    const final = await syncPromise

    expect(final.phase).toBe('failed')
    expect(final.error?.humanMessage).toMatch(/cancel/i)
  })

  // Scenario 13: Progress callbacks fire for each step
  it('scenario 13: emits progress updates for all steps', async () => {
    const svc = makeSyncService()
    const updates: string[] = []

    await svc.runSync((state) => {
      const running = state.steps.find((s: any) => s.status === 'running')
      if (running) updates.push(running.id)
    })

    expect(updates).toContain('unreal-check')
    expect(updates).toContain('fetch')
    expect(updates).toContain('backup')
    expect(updates).toContain('lfs-integrity')
  })
})
