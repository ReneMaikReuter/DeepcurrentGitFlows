import * as fs from 'fs'
import * as path from 'path'

// Extensions that Unreal Engine uses for binary assets.
// These files CANNOT be auto-merged by git — they require explicit user choice.
export const UNREAL_BINARY_EXTENSIONS = ['.uasset', '.umap', '.ubulk', '.uexp'] as const
export const UNREAL_ALL_EXTENSIONS = [...UNREAL_BINARY_EXTENSIONS, '.uproject'] as const

export type UnrealAssetType = 'uasset' | 'umap' | 'ubulk' | 'uexp' | 'uproject'

// Minimum file size we expect for a real Unreal asset (not an LFS pointer).
// LFS pointers are typically < 200 bytes. Real assets are almost always > 1KB.
const LFS_POINTER_MAX_SIZE_BYTES = 512

// LFS pointer files start with this exact string
const LFS_POINTER_PREFIX = 'version https://git-lfs.github.com/spec/v1'

export interface UnrealProjectInfo {
  isUnrealProject: boolean
  uprojectPath: string | null
  projectName: string | null
  hasContentFolder: boolean
  hasSourceFolder: boolean
  hasConfigFolder: boolean
}

export class UnrealDetector {
  constructor(private readonly repositoryPath: string) {}

  detectProject(): UnrealProjectInfo {
    const uprojectFiles = this.findUprojectFiles()
    const uprojectPath = uprojectFiles[0] ?? null

    return {
      isUnrealProject: uprojectPath !== null || this.hasUnrealDirectoryStructure(),
      uprojectPath,
      projectName: uprojectPath ? path.basename(uprojectPath, '.uproject') : null,
      hasContentFolder: fs.existsSync(path.join(this.repositoryPath, 'Content')),
      hasSourceFolder: fs.existsSync(path.join(this.repositoryPath, 'Source')),
      hasConfigFolder: fs.existsSync(path.join(this.repositoryPath, 'Config')),
    }
  }

  static getAssetType(filePath: string): UnrealAssetType | null {
    const ext = path.extname(filePath).toLowerCase()
    const map: Record<string, UnrealAssetType> = {
      '.uasset': 'uasset',
      '.umap': 'umap',
      '.ubulk': 'ubulk',
      '.uexp': 'uexp',
      '.uproject': 'uproject',
    }
    return map[ext] ?? null
  }

  static isUnrealAsset(filePath: string): boolean {
    return UnrealDetector.getAssetType(filePath) !== null
  }

  static isUnrealBinaryAsset(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    return UNREAL_BINARY_EXTENSIONS.includes(ext as (typeof UNREAL_BINARY_EXTENSIONS)[number])
  }

  // Detect if a file is an LFS pointer instead of actual content.
  // This is the core safety check that prevents "LFS pointer disaster" scenarios
  // where a pull appears to succeed but leaves behind tiny pointer files.
  static async detectLfsPointer(
    absoluteFilePath: string,
  ): Promise<{ isPointer: boolean; oid: string | null; expectedSize: number | null }> {
    let stat: fs.Stats
    try {
      stat = await fs.promises.stat(absoluteFilePath)
    } catch {
      return { isPointer: false, oid: null, expectedSize: null }
    }

    // Fast path: real Unreal assets are never this small
    if (stat.size > LFS_POINTER_MAX_SIZE_BYTES) {
      return { isPointer: false, oid: null, expectedSize: null }
    }

    let content: string
    try {
      content = await fs.promises.readFile(absoluteFilePath, 'utf8')
    } catch {
      return { isPointer: false, oid: null, expectedSize: null }
    }

    if (!content.startsWith(LFS_POINTER_PREFIX)) {
      return { isPointer: false, oid: null, expectedSize: null }
    }

    const oidMatch = content.match(/oid sha256:([a-f0-9]{64})/)
    const sizeMatch = content.match(/size (\d+)/)

    return {
      isPointer: true,
      oid: oidMatch ? oidMatch[1] : null,
      expectedSize: sizeMatch ? parseInt(sizeMatch[1], 10) : null,
    }
  }

  private findUprojectFiles(): string[] {
    try {
      return fs
        .readdirSync(this.repositoryPath)
        .filter((f) => f.endsWith('.uproject'))
        .map((f) => path.join(this.repositoryPath, f))
    } catch {
      return []
    }
  }

  private hasUnrealDirectoryStructure(): boolean {
    const indicators = ['Content', 'Config', 'Source']
    const found = indicators.filter((d) => fs.existsSync(path.join(this.repositoryPath, d)))
    return found.length >= 2
  }
}
