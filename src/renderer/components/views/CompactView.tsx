import { useEffect, useState } from 'react'
import { GitBranch, RefreshCw, Upload, Shield, Settings, ChevronDown } from 'lucide-react'
import { useRepoStore } from '../../store/repoStore'
import { ipc, IPC } from '../../hooks/useIpc'
import { useLangStore, useT } from '../../i18n/useT'
import { SettingsModal } from '../ui/SettingsModal'
import { BranchSwitchModal } from '../ui/BranchSwitchModal'
import { WindowControls } from '../ui/WindowControls'
import { ProgressBar } from '../ui/ProgressBar'
import { ToastContainer } from '../ui/ToastContainer'
import { UpdateOverlay } from '../ui/UpdateOverlay'
import { useUpdater } from '../../hooks/useUpdater'
import { toast } from '../../store/toastStore'
import type { AppSettings } from '../../../shared/types'
import './CompactView.css'

function applyFontSize(size: AppSettings['fontSize']) {
  const zoom = size === 'small' ? '0.88' : size === 'large' ? '1.14' : '1'
  ;(document.getElementById('root') as HTMLElement).style.zoom = zoom
}

interface Props {
  onSwitchToPro: () => void
}

export function CompactView({ onSwitchToPro }: Props) {
  const { currentRepo, health, changedFiles, selectedFiles, toggleFileSelection, selectAllFiles, deselectAllFiles, commit, startSync, isSyncing, branches, switchBranch } = useRepoStore()
  const { state: updater, checkForUpdates, installNow, dismiss } = useUpdater()
  const [message, setMessage] = useState('')
  const [committing, setCommitting] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [ueRunning, setUeRunning] = useState(false)
  const [branchMenuOpen, setBranchMenuOpen] = useState(false)
  const [switchModal, setSwitchModal] = useState<string | null>(null)
  const [switching, setSwitching] = useState(false)
  const { setLang } = useLangStore()
  const t = useT()

  const currentBranch = branches.find((b) => b.isCurrent)
  const aheadBy = currentBranch?.aheadBy ?? 0
  const behindBy = currentBranch?.behindBy ?? 0
  const isUnreal = health?.isUnrealProject ?? false

  useEffect(() => {
    ipc.invoke<AppSettings>(IPC.SETTINGS_GET).then((s) => {
      if (s?.fontSize) applyFontSize(s.fontSize)
      if (s?.theme) document.documentElement.setAttribute('data-theme', s.theme)
      if (s?.language) setLang(s.language)
    })
  }, [])

  useEffect(() => {
    const check = async () => {
      const running = await ipc.invoke<boolean>(IPC.UNREAL_IS_RUNNING)
      setUeRunning(!!running)
    }
    check()
    const i = setInterval(check, 5000)
    return () => clearInterval(i)
  }, [])

  const handleCommit = async () => {
    if (!message.trim() || selectedFiles.size === 0) return
    setCommitting(true)
    await commit(message.trim(), false)
    setMessage('')
    setCommitting(false)
  }

  const handleSync = async () => {
    await startSync()
  }

  const handlePush = async () => {
    if (!currentRepo || !currentBranch?.name) return
    setPushing(true)
    const res = await ipc.invoke<{ success: boolean; error: string | null }>(IPC.BRANCH_PUSH, currentRepo.path, currentBranch.name)
    setPushing(false)
    if (res.success) toast.ok('Gepusht.')
    else toast.err(res.error ?? 'Push fehlgeschlagen.')
  }

  const handleBranchSwitch = async (name: string) => {
    setBranchMenuOpen(false)
    if (name === currentBranch?.name) return
    setSwitching(true)
    const result = await switchBranch(name)
    setSwitching(false)
    if (result.requiresAction) setSwitchModal(name)
    else if (result.error) toast.err(result.error)
  }

  const allSelected = changedFiles.length > 0 && selectedFiles.size === changedFiles.length

  if (!currentRepo) return null

  return (
    <div className="compact-root">
      <ProgressBar />
      <ToastContainer />

      {(updater.updateAvailable || updater.updateDownloaded) && updater.version && !updater.dismissed && (
        <UpdateOverlay
          version={updater.version}
          downloadProgress={updater.downloadProgress}
          updateDownloaded={updater.updateDownloaded}
          onInstall={installNow}
          onDismiss={dismiss}
        />
      )}

      {switchModal && (
        <BranchSwitchModal targetBranch={switchModal} onClose={() => setSwitchModal(null)} />
      )}

      {/* Titlebar */}
      <div className="titlebar compact-titlebar">
        <span className="titlebar-app">Deepcurrent Git Flows</span>
        <span className="titlebar-sep">/</span>
        <span className="titlebar-repo truncate">{currentRepo.name}</span>
        <div className="titlebar-spacer" />
        <div className="titlebar-status">
          {isUnreal && ueRunning && (
            <span className="titlebar-safe-mode">
              <Shield size={11} strokeWidth={2.5} />
              {t('unreal_safe_mode')}
            </span>
          )}
          <button className="btn-icon titlebar-settings-btn" onClick={() => setSettingsOpen(true)} title="Einstellungen">
            <Settings size={14} strokeWidth={2} />
          </button>
          <button className="compact-mode-switch" onClick={onSwitchToPro} title="Pro-Modus aktivieren">
            <span className="compact-mode-label">Kompakt</span>
            <span className="compact-mode-toggle compact-mode-toggle--off" />
          </button>
        </div>
        <WindowControls />
      </div>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} onCheckUpdate={checkForUpdates} noUpdate={updater.noUpdate} />}

      {/* Branch + Sync strip */}
      <div className="compact-branch-bar">
        <div className="compact-branch-selector" style={{ position: 'relative' }}>
          <button
            className="compact-branch-btn"
            onClick={() => setBranchMenuOpen((v) => !v)}
            disabled={switching}
            title="Branch wechseln"
          >
            <GitBranch size={11} strokeWidth={2} />
            <span className="compact-branch-name">{currentBranch?.name ?? '...'}</span>
            <ChevronDown size={10} strokeWidth={2} />
          </button>
          {branchMenuOpen && (
            <div className="compact-branch-dropdown">
              {branches.filter((b) => !b.isRemote).map((b) => (
                <button
                  key={b.name}
                  className={`compact-branch-option ${b.isCurrent ? 'active' : ''}`}
                  onClick={() => handleBranchSwitch(b.name)}
                >
                  <GitBranch size={10} strokeWidth={2} />
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {behindBy > 0 && <span className="compact-badge compact-badge--behind">↓{behindBy}</span>}
        {aheadBy > 0 && <span className="compact-badge compact-badge--ahead">↑{aheadBy}</span>}
        <div style={{ flex: 1 }} />
        {aheadBy > 0 && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={handlePush}
            disabled={pushing}
            title={`${aheadBy} Commit(s) pushen`}
          >
            <Upload size={11} strokeWidth={2} />
            Push
          </button>
        )}
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleSync}
          disabled={isSyncing}
          title="Sync mit Remote"
        >
          <RefreshCw size={11} strokeWidth={2} className={isSyncing ? 'spin' : ''} />
          Sync
        </button>
      </div>

      {/* File list */}
      <div className="compact-files">
        {changedFiles.length === 0 ? (
          <div className="compact-empty">Keine Änderungen</div>
        ) : (
          <>
            <div className="compact-files-header">
              <label className="compact-checkbox-row">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => allSelected ? deselectAllFiles() : selectAllFiles()}
                />
                <span>Alle auswählen ({changedFiles.length})</span>
              </label>
            </div>
            <div className="compact-files-list">
              {changedFiles.map((f) => (
                <label key={f.path} className="compact-file-row">
                  <input
                    type="checkbox"
                    checked={selectedFiles.has(f.path)}
                    onChange={() => toggleFileSelection(f.path)}
                  />
                  <span className={`compact-file-status compact-file-status--${f.status}`}>{f.status.toUpperCase().slice(0, 1)}</span>
                  <span className="compact-file-path truncate">{f.path.split('/').pop() ?? f.path}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Commit area */}
      <div className="compact-commit">
        <textarea
          className="compact-commit-input"
          placeholder="Commit-Nachricht..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleCommit()
          }}
        />
        <button
          className="btn btn-primary compact-commit-btn"
          onClick={handleCommit}
          disabled={!message.trim() || selectedFiles.size === 0 || committing}
        >
          <Upload size={12} strokeWidth={2} />
          {committing ? 'Wird committet...' : `Commit (${selectedFiles.size})`}
        </button>
      </div>
    </div>
  )
}
