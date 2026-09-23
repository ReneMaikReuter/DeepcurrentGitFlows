import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import type { AppSettings, Repository } from '../../shared/types'
import { DEFAULT_SETTINGS } from '../../shared/types'

const SETTINGS_DIR = path.join(os.homedir(), '.deepcurrent')
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.json')

export class SettingsService {
  private static instance: SettingsService
  private settings: AppSettings = { ...DEFAULT_SETTINGS }

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService()
    }
    return SettingsService.instance
  }

  async load(): Promise<void> {
    try {
      await fs.promises.mkdir(SETTINGS_DIR, { recursive: true })
      const raw = await fs.promises.readFile(SETTINGS_FILE, 'utf8')
      const saved = JSON.parse(raw)
      // Migrate: remove old hardcoded defaults that user never set
      const OLD_DEFAULTS = ['main', 'master', 'development']
      if (
        Array.isArray(saved.protectedBranches) &&
        saved.protectedBranches.length === OLD_DEFAULTS.length &&
        OLD_DEFAULTS.every((b: string, i: number) => saved.protectedBranches[i] === b)
      ) {
        saved.protectedBranches = []
      }
      this.settings = { ...DEFAULT_SETTINGS, ...saved }
    } catch {
      // First run — use defaults
      this.settings = { ...DEFAULT_SETTINGS }
    }
  }

  async save(): Promise<void> {
    await fs.promises.mkdir(SETTINGS_DIR, { recursive: true })
    await fs.promises.writeFile(SETTINGS_FILE, JSON.stringify(this.settings, null, 2), 'utf8')
  }

  get(): AppSettings {
    return { ...this.settings }
  }

  async patch(partial: Partial<AppSettings>): Promise<AppSettings> {
    this.settings = { ...this.settings, ...partial }
    await this.save()
    return { ...this.settings }
  }

  async saveRepository(repo: Repository): Promise<void> {
    const existing = this.settings.savedRepositories.findIndex((r) => r.id === repo.id)
    if (existing >= 0) {
      this.settings.savedRepositories[existing] = repo
    } else {
      this.settings.savedRepositories.unshift(repo)
    }
    await this.save()
  }

  async removeRepository(id: string): Promise<void> {
    this.settings.savedRepositories = this.settings.savedRepositories.filter((r) => r.id !== id)
    if (this.settings.lastOpenedRepositoryId === id) {
      this.settings.lastOpenedRepositoryId = null
    }
    await this.save()
  }

  async setLastOpened(id: string): Promise<void> {
    this.settings.lastOpenedRepositoryId = id
    await this.save()
  }
}
