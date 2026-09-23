import { useState, useEffect } from 'react'
import { Shield, Lock, RotateCcw, Info, Plus, X, FileX, FolderOpen, BookOpen } from 'lucide-react'
import { Modal } from './Modal'
import { ipc, IPC } from '../../hooks/useIpc'
import { useLangStore, useT } from '../../i18n/useT'
import { manualContent } from '../../i18n/manualContent'
import type { AppSettings, Branch } from '../../../shared/types'
import './SettingsModal.css'

const VERSION = '0.1.8'

interface Props { onClose: () => void; onCheckUpdate?: () => void; noUpdate?: boolean }

function applyFontSize(size: AppSettings['fontSize']) {
  const zoom = size === 'small' ? '0.88' : size === 'large' ? '1.14' : '1'
  ;(document.getElementById('root') as HTMLElement).style.zoom = zoom
}

function applyTheme(theme: AppSettings['theme']) {
  document.documentElement.setAttribute('data-theme', theme)
}

export function SettingsModal({ onClose, onCheckUpdate, noUpdate }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [availableBranches, setAvailableBranches] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const { setLang, lang } = useLangStore()
  const t = useT()
  const [gitignoreLines, setGitignoreLines] = useState<string[]>([])
  const [newIgnore, setNewIgnore] = useState('')
  const [ignoreSaved, setIgnoreSaved] = useState(false)
  const [activeTab, setActiveTab] = useState<'settings' | 'manual'>('settings')

  const [currentRepo, setCurrentRepo] = useState<string | null>(null)

  useEffect(() => {
    ipc.invoke<AppSettings>(IPC.SETTINGS_GET).then((s) => {
      setSettings(s)
      if (s?.theme) applyTheme(s.theme)
    })
    import('../../store/repoStore').then(({ useRepoStore }) => {
      const state = useRepoStore.getState()
      const repo = state.currentRepo
      if (repo?.path) {
        setCurrentRepo(repo.path)
        ipc.invoke<string[]>(IPC.GITIGNORE_GET, repo.path).then((lines) => setGitignoreLines(lines ?? []))
      }
      const branches: Branch[] = state.branches ?? []
      setAvailableBranches(branches.filter((b) => !b.isRemote).map((b) => b.name))
    })
  }, [])

  const save = async (patch: Partial<AppSettings>) => {
    if (!settings) return
    const merged = { ...settings, ...patch }
    setSettings(merged)
    await ipc.invoke<AppSettings>(IPC.SETTINGS_SET, patch)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    if (patch.fontSize) applyFontSize(patch.fontSize)
    if (patch.theme) applyTheme(patch.theme)
    if (patch.language) setLang(patch.language)
  }

  const addProtected = (name: string) => {
    if (!name || !settings) return
    if (settings.protectedBranches.includes(name)) return
    save({ protectedBranches: [...settings.protectedBranches, name] })
  }

  const removeProtected = (name: string) => {
    if (!settings) return
    save({ protectedBranches: settings.protectedBranches.filter((b) => b !== name) })
  }

  if (!settings) return null

  const currentLang = (settings.language ?? lang ?? 'de') as 'de' | 'en'
  const manual = manualContent[currentLang]

  return (
    <Modal title={t('settings_title')} onClose={onClose} width={activeTab === 'manual' ? 660 : 480}>
      {saved && <div className="settings-saved" aria-live="polite">{t('settings_saved')} ✓</div>}

      {/* Tab bar */}
      <div className="settings-tabs">
        <button
          className={`settings-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          {t('settings_tab_settings')}
        </button>
        <button
          className={`settings-tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
          onClick={() => setActiveTab('manual')}
        >
          <BookOpen size={11} strokeWidth={2} />
          {t('settings_tab_manual')}
        </button>
      </div>

      {activeTab === 'settings' ? (
        <>
          {/* Font size */}
          <div className="settings-section">
            <div className="settings-section-title">{t('settings_appearance')}</div>

            <div className="settings-row">
              <div className="settings-label">
                <span>{t('settings_font_size')}</span>
              </div>
              <div className="settings-seg">
                {(['small', 'normal', 'large'] as const).map((s) => (
                  <button
                    key={s}
                    className={`settings-seg-btn ${settings.fontSize === s ? 'active' : ''}`}
                    onClick={() => save({ fontSize: s })}
                  >
                    {s === 'small' ? t('settings_font_small') : s === 'normal' ? t('settings_font_normal') : t('settings_font_large')}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-label">
                <span>{t('settings_theme')}</span>
              </div>
              <div className="settings-seg">
                {(['dark', 'light'] as const).map((th) => (
                  <button
                    key={th}
                    className={`settings-seg-btn ${settings.theme === th ? 'active' : ''}`}
                    onClick={() => save({ theme: th })}
                  >
                    {th === 'dark' ? t('settings_theme_dark') : t('settings_theme_light')}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-label">
                <span>{t('settings_language')}</span>
                <span className="settings-hint">{t('settings_language_hint')}</span>
              </div>
              <div className="settings-seg">
                {(['de', 'en'] as const).map((l) => (
                  <button
                    key={l}
                    className={`settings-seg-btn ${settings.language === l ? 'active' : ''}`}
                    onClick={() => save({ language: l })}
                  >
                    {l === 'de' ? 'Deutsch' : 'English'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Repository */}
          <div className="settings-section">
            <div className="settings-section-title">{t('settings_repository')}</div>

            <div className="settings-row">
              <div className="settings-label">
                <span>{t('settings_default_branch')}</span>
                <span className="settings-hint">{t('settings_default_branch_hint')}</span>
              </div>
              <input
                className="settings-input-sm"
                value={settings.defaultBranch}
                onChange={(e) => setSettings({ ...settings, defaultBranch: e.target.value })}
                onBlur={() => save({ defaultBranch: settings.defaultBranch })}
                onKeyDown={(e) => { if (e.key === 'Enter') save({ defaultBranch: settings.defaultBranch }) }}
              />
            </div>

            <div className="settings-row settings-row--top">
              <div className="settings-label">
                <span>{t('settings_protected_branches')}</span>
                <span className="settings-hint">{t('settings_protected_hint')}</span>
              </div>
              <div className="settings-protected-list">
                {settings.protectedBranches.map((b) => (
                  <div key={b} className="settings-protected-tag">
                    <Shield size={10} strokeWidth={2} />
                    {b}
                    <button className="settings-protected-remove" onClick={() => removeProtected(b)}>
                      <X size={9} />
                    </button>
                  </div>
                ))}
                <div className="settings-protected-add">
                  <select
                    className="settings-input-sm"
                    defaultValue=""
                    style={{ width: 160 }}
                    onChange={(e) => { if (e.target.value) addProtected(e.target.value); e.target.value = '' }}
                  >
                    <option value="" disabled>{t('settings_add_branch')}</option>
                    {availableBranches
                      .filter((b) => !settings.protectedBranches.includes(b))
                      .map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Backups */}
          <div className="settings-section">
            <div className="settings-section-title">{t('settings_backups')}</div>

            <div className="settings-row">
              <div className="settings-label">
                <span>{t('settings_max_backups')}</span>
              </div>
              <div className="settings-seg">
                {[5, 10, 20, 50].map((n) => (
                  <button
                    key={n}
                    className={`settings-seg-btn ${settings.backupRetentionCount === n ? 'active' : ''}`}
                    onClick={() => save({ backupRetentionCount: n })}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-label">
                <span>{t('settings_auto_delete')}</span>
                <span className="settings-hint">{t('settings_auto_delete_hint')}</span>
              </div>
              <button
                className={`settings-toggle ${settings.backupAutoDelete ? 'active' : ''}`}
                onClick={() => save({ backupAutoDelete: !settings.backupAutoDelete })}
              >
                <span className="settings-toggle-knob" />
              </button>
            </div>
          </div>

          {/* LFS */}
          <div className="settings-section">
            <div className="settings-section-title">{t('settings_lfs')}</div>

            <div className="settings-row">
              <div className="settings-label">
                <Lock size={12} strokeWidth={2} style={{ color: 'var(--warning)' }} />
                <span>{t('settings_lfs_autolock')}</span>
                <span className="settings-hint">{t('settings_lfs_autolock_hint')}</span>
              </div>
              <button
                className={`settings-toggle ${settings.lfsAutoLock ? 'active' : ''}`}
                onClick={() => save({ lfsAutoLock: !settings.lfsAutoLock })}
              >
                <span className="settings-toggle-knob" />
              </button>
            </div>
          </div>

          {/* Gitignore */}
          {currentRepo && (
            <div className="settings-section">
              <div className="settings-section-title">
                <FileX size={11} strokeWidth={2} style={{ display: 'inline', marginRight: 4 }} />
                .gitignore
              </div>
              <div className="settings-row">
                <div className="settings-label">
                  <span>{t('settings_gitignore')}</span>
                  <span className="settings-hint">{t('settings_gitignore_hint')}</span>
                </div>
              </div>
              <div className="settings-protected-list" style={{ marginBottom: 'var(--sp-2)' }}>
                {gitignoreLines.map((line) => (
                  <div key={line} className="settings-protected-tag">
                    <FileX size={10} strokeWidth={2} />
                    {line}
                    <button className="settings-protected-remove" onClick={async () => {
                      const next = gitignoreLines.filter((l) => l !== line)
                      setGitignoreLines(next)
                      await ipc.invoke(IPC.GITIGNORE_SET, currentRepo, next)
                      setIgnoreSaved(true); setTimeout(() => setIgnoreSaved(false), 1500)
                    }}>
                      <X size={9} />
                    </button>
                  </div>
                ))}
                {gitignoreLines.length === 0 && (
                  <span className="settings-hint" style={{ padding: '2px 0' }}>{t('settings_gitignore_none')}</span>
                )}
              </div>
              {ignoreSaved && <div className="settings-saved" aria-live="polite">Gespeichert ✓</div>}
              <div className="settings-protected-add" style={{ flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
                <input
                  className="settings-input-sm"
                  placeholder="z.B. *.log oder /Temp/"
                  value={newIgnore}
                  onChange={(e) => setNewIgnore(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key !== 'Enter') return
                    const val = newIgnore.trim()
                    if (!val || gitignoreLines.includes(val)) return
                    const next = [...gitignoreLines, val]
                    setGitignoreLines(next)
                    setNewIgnore('')
                    await ipc.invoke(IPC.GITIGNORE_SET, currentRepo, next)
                    setIgnoreSaved(true); setTimeout(() => setIgnoreSaved(false), 1500)
                  }}
                  style={{ width: 150, flexShrink: 0 }}
                />
                <button className="btn btn-ghost btn-sm" onClick={async () => {
                  const val = newIgnore.trim()
                  if (!val || gitignoreLines.includes(val)) return
                  const next = [...gitignoreLines, val]
                  setGitignoreLines(next)
                  setNewIgnore('')
                  await ipc.invoke(IPC.GITIGNORE_SET, currentRepo, next)
                  setIgnoreSaved(true); setTimeout(() => setIgnoreSaved(false), 1500)
                }}>
                  <Plus size={11} /> {t('settings_add')}
                </button>
                <button className="btn btn-ghost btn-sm" title={t('settings_pick_folder')} onClick={async () => {
                  if (!currentRepo) return
                  const paths = await ipc.invoke<string[] | null>(IPC.DIALOG_PICK_PATH, currentRepo)
                  if (!paths) return
                  const toAdd = paths.filter((p) => p && !gitignoreLines.includes(p))
                  if (toAdd.length === 0) return
                  const next = [...gitignoreLines, ...toAdd]
                  setGitignoreLines(next)
                  await ipc.invoke(IPC.GITIGNORE_SET, currentRepo, next)
                  setIgnoreSaved(true); setTimeout(() => setIgnoreSaved(false), 1500)
                }}>
                  <FolderOpen size={11} /> {t('settings_pick_folder')}
                </button>
              </div>
            </div>
          )}

          {/* About */}
          <div className="settings-section settings-section--about">
            <Info size={12} strokeWidth={2} style={{ color: 'var(--text-secondary)' }} />
            <span className="settings-about-text">Deepcurrent Git Flows <strong>v{VERSION}</strong>. {t('settings_about')}</span>
            {onCheckUpdate && (
              <button className="btn btn-ghost btn-sm" onClick={onCheckUpdate} title="Auf neue Version prüfen">
                <RotateCcw size={10} /> {noUpdate ? 'Aktuell' : 'Updates suchen'}
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => ipc.invoke(IPC.SETTINGS_GET).then(() => window.location.reload())}>
              <RotateCcw size={10} /> {t('settings_restart')}
            </button>
          </div>
        </>
      ) : (
        <div className="manual-view">
          {manual.sections.map((section) => (
            <div key={section.id} className="manual-section">
              <div className="manual-section-title">{section.title}</div>
              {section.intro && <p className="manual-intro">{section.intro}</p>}

              {section.items && section.items.length > 0 && (
                <div className="manual-items">
                  {section.items.map((item, i) => (
                    <div key={i} className="manual-item">
                      {item.label && <span className="manual-item-label">{item.label}</span>}
                      <span className="manual-item-text">{item.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {section.subsections && section.subsections.map((sub, si) => (
                <div key={si} className="manual-subsection">
                  <div className="manual-subsection-title">{sub.title}</div>
                  {sub.intro && <p className="manual-sub-intro">{sub.intro}</p>}
                  {sub.items && sub.items.length > 0 && (
                    <div className="manual-items">
                      {sub.items.map((item, ii) => (
                        <div key={ii} className="manual-item">
                          {item.label && <span className="manual-item-label">{item.label}</span>}
                          <span className="manual-item-text">{item.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
