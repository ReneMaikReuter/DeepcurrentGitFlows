import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { promisify } from 'util'
import type { Backup } from '../../shared/types'

const copyFile = promisify(fs.copyFile)
const mkdir = promisify(fs.mkdir)

const DEFAULT_RETENTION_COUNT = 10

// Backups are stored in AppData, NOT inside the repository.
// This avoids polluting git status with backup files.
function getBackupRoot(repositoryPath: string): string {
  const appData = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming')
  // Use a hash-safe folder name derived from the repo path
  const repoSlug = repositoryPath.replace(/[^a-zA-Z0-9]/g, '_').slice(-60)
  return path.join(appData, 'deepcurrent-git-client', 'backups', repoSlug)
}

export class BackupService {
  private readonly backupRoot: string
  private retentionCount: number

  constructor(
    private readonly repositoryPath: string,
    retentionCount: number = DEFAULT_RETENTION_COUNT,
  ) {
    this.backupRoot = getBackupRoot(repositoryPath)
    this.retentionCount = retentionCount
  }

  // Remove legacy in-repo backup folder if it exists (one-time migration).
  async migrateOutOfRepo(): Promise<void> {
    const legacyPath = path.join(this.repositoryPath, '.deepcurrent', 'backups')
    if (fs.existsSync(legacyPath)) {
      await fs.promises.rm(legacyPath, { recursive: true, force: true })
    }
    // Remove .deepcurrent dir entirely if now empty
    const dcPath = path.join(this.repositoryPath, '.deepcurrent')
    if (fs.existsSync(dcPath)) {
      try {
        const remaining = await fs.promises.readdir(dcPath)
        if (remaining.length === 0) {
          await fs.promises.rmdir(dcPath)
        }
      } catch { /* ignore */ }
    }
  }

  async createBackup(triggeredBy: string, specificPaths?: string[]): Promise<Backup> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backupId = `${timestamp}_${triggeredBy.replace(/[^a-zA-Z0-9]/g, '-')}`
    const backupPath = path.join(this.backupRoot, backupId)

    await mkdir(backupPath, { recursive: true })

    const filesToBackup = specificPaths
      ? specificPaths.map((p) => path.join(this.repositoryPath, p))
      : await this.findUnrealAssets()

    let fileCount = 0
    for (const srcPath of filesToBackup) {
      if (!fs.existsSync(srcPath)) continue

      const relativePath = path.relative(this.repositoryPath, srcPath)
      const destPath = path.join(backupPath, relativePath)
      const destDir = path.dirname(destPath)

      await mkdir(destDir, { recursive: true })
      await copyFile(srcPath, destPath)
      fileCount++
    }

    // Write metadata
    const meta: Backup = {
      id: backupId,
      path: backupPath,
      createdAt: Date.now(),
      triggeredBy,
      fileCount,
      repositoryPath: this.repositoryPath,
    }
    await fs.promises.writeFile(path.join(backupPath, 'backup.json'), JSON.stringify(meta, null, 2))

    await this.pruneOldBackups()

    return meta
  }

  async listBackups(): Promise<Backup[]> {
    if (!fs.existsSync(this.backupRoot)) return []

    const entries = await fs.promises.readdir(this.backupRoot, { withFileTypes: true })
    const backups: Backup[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const metaPath = path.join(this.backupRoot, entry.name, 'backup.json')
      if (!fs.existsSync(metaPath)) continue

      try {
        const raw = await fs.promises.readFile(metaPath, 'utf8')
        backups.push(JSON.parse(raw) as Backup)
      } catch {
        // Corrupted backup metadata — skip
      }
    }

    return backups.sort((a, b) => b.createdAt - a.createdAt)
  }

  async restoreBackup(backupId: string): Promise<{ success: boolean; restoredCount: number; error: string | null }> {
    if (!this.isValidBackupId(backupId)) {
      return { success: false, restoredCount: 0, error: 'Invalid backup ID.' }
    }
    const backupPath = path.join(this.backupRoot, backupId)
    if (!path.resolve(backupPath).startsWith(path.resolve(this.backupRoot) + path.sep)) {
      return { success: false, restoredCount: 0, error: 'Invalid backup path.' }
    }
    if (!fs.existsSync(backupPath)) {
      return { success: false, restoredCount: 0, error: 'Backup not found.' }
    }

    let restoredCount = 0
    const errors: string[] = []

    const files = await this.walkDirectory(backupPath)
    for (const srcPath of files) {
      if (srcPath.endsWith('backup.json')) continue

      const relativePath = path.relative(backupPath, srcPath)
      const destPath = path.join(this.repositoryPath, relativePath)
      const destDir = path.dirname(destPath)

      try {
        await mkdir(destDir, { recursive: true })
        await copyFile(srcPath, destPath)
        restoredCount++
      } catch (err) {
        errors.push(`Failed to restore ${relativePath}: ${String(err)}`)
      }
    }

    return {
      success: errors.length === 0,
      restoredCount,
      error: errors.length > 0 ? errors.join('\n') : null,
    }
  }

  async deleteBackup(backupId: string): Promise<boolean> {
    if (!this.isValidBackupId(backupId)) return false
    const backupPath = path.join(this.backupRoot, backupId)
    if (!path.resolve(backupPath).startsWith(path.resolve(this.backupRoot) + path.sep)) return false
    if (!fs.existsSync(backupPath)) return false

    await fs.promises.rm(backupPath, { recursive: true, force: true })
    return true
  }

  private isValidBackupId(backupId: string): boolean {
    return /^[\w-]+$/.test(backupId)
  }

  private async pruneOldBackups(): Promise<void> {
    const backups = await this.listBackups()
    const toDelete = backups.slice(this.retentionCount)
    for (const backup of toDelete) {
      await this.deleteBackup(backup.id)
    }
  }

  private async findUnrealAssets(): Promise<string[]> {
    const extensions = ['.uasset', '.umap', '.ubulk', '.uexp']
    return this.walkDirectory(this.repositoryPath, (f) =>
      extensions.some((ext) => f.endsWith(ext)),
    )
  }

  private async walkDirectory(dir: string, filter?: (f: string) => boolean): Promise<string[]> {
    const results: string[] = []

    const walk = async (current: string) => {
      // Skip .git and .deepcurrent directories
      const base = path.basename(current)
      if (base === '.git' || base === '.deepcurrent' || base === 'node_modules') return

      let entries: fs.Dirent[]
      try {
        entries = await fs.promises.readdir(current, { withFileTypes: true })
      } catch {
        return
      }

      for (const entry of entries) {
        const fullPath = path.join(current, entry.name)
        if (entry.isDirectory()) {
          await walk(fullPath)
        } else if (!filter || filter(fullPath)) {
          results.push(fullPath)
        }
      }
    }

    await walk(dir)
    return results
  }
}
