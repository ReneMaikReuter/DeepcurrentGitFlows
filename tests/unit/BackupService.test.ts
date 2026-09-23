import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { BackupService } from '../../src/main/services/BackupService'

// Use real filesystem in a temp directory
let tempDir: string
let backupService: BackupService

beforeEach(async () => {
  tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'deepcurrent-test-'))
  backupService = new BackupService(tempDir, 3) // low retention for testing

  // Create fake Unreal assets
  await fs.promises.mkdir(path.join(tempDir, 'Content', 'Characters'), { recursive: true })
  await fs.promises.writeFile(path.join(tempDir, 'Content', 'Characters', 'Hero.uasset'), Buffer.alloc(1024, 0x42))
  await fs.promises.writeFile(path.join(tempDir, 'Content', 'Characters', 'Hero.umap'), Buffer.alloc(2048, 0x43))
})

afterEach(async () => {
  await fs.promises.rm(tempDir, { recursive: true, force: true })
})

describe('BackupService', () => {
  // Scenario 15: backup created successfully
  it('scenario 15: creates a backup with correct file count', async () => {
    const backup = await backupService.createBackup('pre-sync')

    expect(backup.fileCount).toBe(2) // 2 Unreal assets
    expect(backup.triggeredBy).toBe('pre-sync')
    expect(backup.path).toMatch(/\.deepcurrent[/\\]backups/)

    // Backup directory should exist
    expect(fs.existsSync(backup.path)).toBe(true)

    // Backup metadata file should exist
    expect(fs.existsSync(path.join(backup.path, 'backup.json'))).toBe(true)
  })

  // Scenario 15b: backup and restore round-trip
  it('scenario 15: restores files correctly', async () => {
    const backup = await backupService.createBackup('test')

    // Overwrite the original file to simulate corruption
    const assetPath = path.join(tempDir, 'Content', 'Characters', 'Hero.uasset')
    await fs.promises.writeFile(assetPath, Buffer.alloc(4, 0x00)) // corrupt: 4 bytes

    // Verify it's corrupted
    const corruptedSize = (await fs.promises.stat(assetPath)).size
    expect(corruptedSize).toBe(4)

    // Restore
    const result = await backupService.restoreBackup(backup.id)
    expect(result.success).toBe(true)
    expect(result.restoredCount).toBe(2)

    // Verify restored
    const restoredSize = (await fs.promises.stat(assetPath)).size
    expect(restoredSize).toBe(1024)
  })

  // Retention: old backups are pruned
  it('prunes old backups beyond retention count', async () => {
    // Create 5 backups (retention is 3)
    for (let i = 0; i < 5; i++) {
      await backupService.createBackup(`backup-${i}`)
      // Small delay to ensure different timestamps in IDs
      await new Promise((r) => setTimeout(r, 5))
    }

    const list = await backupService.listBackups()
    expect(list.length).toBeLessThanOrEqual(3)
  })

  // Restoring non-existent backup returns error
  it('returns error when restoring non-existent backup', async () => {
    const result = await backupService.restoreBackup('does-not-exist')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/not found/i)
  })

  // Backup can be deleted
  it('deletes a backup and removes it from list', async () => {
    const backup = await backupService.createBackup('to-delete')
    const deleted = await backupService.deleteBackup(backup.id)
    expect(deleted).toBe(true)

    const list = await backupService.listBackups()
    expect(list.find((b) => b.id === backup.id)).toBeUndefined()
  })

  // Specific file backup (for discard-changes scenario)
  it('backs up only specified files', async () => {
    const specificFiles = ['Content/Characters/Hero.uasset']
    const backup = await backupService.createBackup('discard-changes', specificFiles)
    expect(backup.fileCount).toBe(1)
  })
})
