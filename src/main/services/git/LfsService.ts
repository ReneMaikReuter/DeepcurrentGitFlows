import * as fs from 'fs'
import * as path from 'path'
import { GitExecutor } from './GitExecutor'
import { UnrealDetector, UNREAL_BINARY_EXTENSIONS } from './UnrealDetector'
import type { LfsPointerFile, LfsStatus } from '../../../shared/types'

// LfsService handles all Git LFS interactions.
// The most critical safety task: detecting LFS pointer files that were NOT
// hydrated to real content after a pull — a silent failure mode that can
// corrupt a project if undetected.
export class LfsService {
  private readonly executor: GitExecutor

  constructor(private readonly repositoryPath: string) {
    this.executor = new GitExecutor(repositoryPath)
  }

  async getStatus(): Promise<LfsStatus> {
    const errors: string[] = []

    const isInstalled = (await GitExecutor.checkGitLfs()) !== null
    if (!isInstalled) {
      return {
        isInstalled: false,
        isInitialized: false,
        trackedPatterns: [],
        pointerFiles: [],
        missingObjects: [],
        errors: ['Git LFS is not installed.'],
      }
    }

    const isInitialized = await this.isLfsInitialized()
    const trackedPatterns = await this.getTrackedPatterns()
    const pointerFiles = await this.scanForPointerFiles()
    const missingObjects = await this.getMissingObjects()

    if (!isInitialized) {
      errors.push('Git LFS is installed but not initialized in this repository.')
    }
    if (missingObjects.length > 0) {
      errors.push(`${missingObjects.length} LFS object(s) are missing from local storage.`)
    }

    return {
      isInstalled,
      isInitialized,
      trackedPatterns,
      pointerFiles,
      missingObjects,
      errors,
    }
  }

  // Scan all Unreal asset files in the working tree and check if any are LFS pointers.
  // This is the "LFS pointer disaster" detection — a pull that appears successful
  // but leaves behind pointer files instead of real assets.
  async scanForPointerFiles(): Promise<LfsPointerFile[]> {
    const pointers: LfsPointerFile[] = []

    // Use git ls-files to get all tracked Unreal assets
    const result = await this.executor.git([
      'ls-files',
      '--',
      ...UNREAL_BINARY_EXTENSIONS.map((ext) => `*${ext}`),
    ])
    if (!result.success) return []

    const filePaths = result.stdout.split('\n').filter(Boolean)

    await Promise.all(
      filePaths.map(async (relativePath) => {
        const absolutePath = path.join(this.repositoryPath, relativePath)

        let actualSize: number
        try {
          const stat = await fs.promises.stat(absolutePath)
          actualSize = stat.size
        } catch {
          return // File doesn't exist locally
        }

        const detection = await UnrealDetector.detectLfsPointer(absolutePath)
        if (detection.isPointer) {
          pointers.push({
            path: relativePath,
            oid: detection.oid ?? '',
            expectedSizeBytes: detection.expectedSize ?? 0,
            actualSizeBytes: actualSize,
            isRestored: false,
          })
        }
      }),
    )

    return pointers
  }

  // Attempt to fetch and restore LFS pointer files.
  // Returns the list of files that were successfully restored.
  async fetchAndRestorePointers(pointerPaths: string[]): Promise<string[]> {
    if (pointerPaths.length === 0) return []

    const result = await this.executor.lfs(['pull', '--include', pointerPaths.join(',')], {
      timeoutMs: 300_000, // Large files may take a while
    })

    if (!result.success) return []

    // Re-check which files are no longer pointers
    const restored: string[] = []
    for (const relativePath of pointerPaths) {
      const absPath = path.join(this.repositoryPath, relativePath)
      const detection = await UnrealDetector.detectLfsPointer(absPath)
      if (!detection.isPointer) {
        restored.push(relativePath)
      }
    }

    return restored
  }

  async getLfsTrackedFiles(): Promise<string[]> {
    const result = await this.executor.lfs(['ls-files', '--name-only'])
    if (!result.success) return []
    return result.stdout.split('\n').filter(Boolean)
  }

  async isFileTrackedByLfs(filePath: string): Promise<boolean> {
    const result = await this.executor.git(['check-attr', 'filter', '--', filePath])
    return result.success && result.stdout.includes('filter: lfs')
  }

  async fetchAll(): Promise<{ success: boolean; error: string | null }> {
    const result = await this.executor.lfs(['fetch', '--all'], { timeoutMs: 300_000 })
    return { success: result.success, error: result.success ? null : result.stderr }
  }

  private async isLfsInitialized(): Promise<boolean> {
    const result = await this.executor.lfs(['status'])
    return result.success
  }

  private async getTrackedPatterns(): Promise<string[]> {
    const result = await this.executor.lfs(['track'])
    if (!result.success) return []

    const patterns: string[] = []
    for (const line of result.stdout.split('\n')) {
      const match = line.match(/^\s+(.+?) \(/)
      if (match) patterns.push(match[1].trim())
    }
    return patterns
  }

  private async getMissingObjects(): Promise<string[]> {
    const result = await this.executor.lfs(['fsck', '--pointers'])
    if (!result.success && result.stderr.includes('missing')) {
      return result.stderr
        .split('\n')
        .filter((l) => l.includes('missing'))
        .map((l) => l.replace(/.*missing.*: /, '').trim())
    }
    return []
  }
}
