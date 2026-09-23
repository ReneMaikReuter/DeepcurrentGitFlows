import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import { UnrealDetector } from '../../src/main/services/git/UnrealDetector'

vi.mock('fs')

describe('UnrealDetector', () => {
  describe('getAssetType', () => {
    it('identifies uasset files', () => {
      expect(UnrealDetector.getAssetType('Content/Hero.uasset')).toBe('uasset')
    })

    it('identifies umap files', () => {
      expect(UnrealDetector.getAssetType('Content/Maps/Level.umap')).toBe('umap')
    })

    it('identifies ubulk files', () => {
      expect(UnrealDetector.getAssetType('Content/Texture.ubulk')).toBe('ubulk')
    })

    it('returns null for non-Unreal files', () => {
      expect(UnrealDetector.getAssetType('Source/Combat.cpp')).toBeNull()
      expect(UnrealDetector.getAssetType('README.md')).toBeNull()
    })

    it('is case insensitive for extension', () => {
      expect(UnrealDetector.getAssetType('Asset.UASSET')).toBe('uasset')
    })
  })

  describe('isUnrealBinaryAsset', () => {
    it('returns true for binary Unreal extensions', () => {
      expect(UnrealDetector.isUnrealBinaryAsset('a.uasset')).toBe(true)
      expect(UnrealDetector.isUnrealBinaryAsset('b.umap')).toBe(true)
      expect(UnrealDetector.isUnrealBinaryAsset('c.ubulk')).toBe(true)
      expect(UnrealDetector.isUnrealBinaryAsset('d.uexp')).toBe(true)
    })

    it('returns false for uproject (not binary in the same sense)', () => {
      expect(UnrealDetector.isUnrealBinaryAsset('Game.uproject')).toBe(false)
    })

    it('returns false for source files', () => {
      expect(UnrealDetector.isUnrealBinaryAsset('Combat.cpp')).toBe(false)
    })
  })

  describe('detectLfsPointer', () => {
    it('detects a valid LFS pointer file', async () => {
      const pointerContent = [
        'version https://git-lfs.github.com/spec/v1',
        'oid sha256:' + 'a'.repeat(64),
        'size 8847360',
        '',
      ].join('\n')

      vi.spyOn(fs.promises, 'stat').mockResolvedValue({ size: 133 } as fs.Stats)
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue(pointerContent as any)

      const result = await UnrealDetector.detectLfsPointer('/repo/Content/Hero.uasset')
      expect(result.isPointer).toBe(true)
      expect(result.expectedSize).toBe(8847360)
      expect(result.oid).toBe('a'.repeat(64))
    })

    it('returns isPointer: false for a large file', async () => {
      vi.spyOn(fs.promises, 'stat').mockResolvedValue({ size: 8_000_000 } as fs.Stats)

      const result = await UnrealDetector.detectLfsPointer('/repo/Content/Hero.uasset')
      expect(result.isPointer).toBe(false)
    })

    it('returns isPointer: false for a small file that is not an LFS pointer', async () => {
      vi.spyOn(fs.promises, 'stat').mockResolvedValue({ size: 128 } as fs.Stats)
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue('not an lfs pointer' as any)

      const result = await UnrealDetector.detectLfsPointer('/repo/Content/Hero.uasset')
      expect(result.isPointer).toBe(false)
    })

    it('returns isPointer: false when file does not exist', async () => {
      vi.spyOn(fs.promises, 'stat').mockRejectedValue(new Error('ENOENT'))

      const result = await UnrealDetector.detectLfsPointer('/repo/Content/Missing.uasset')
      expect(result.isPointer).toBe(false)
    })
  })
})
