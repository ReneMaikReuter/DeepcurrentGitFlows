import { useEffect, useState } from 'react'
import { GitBranch, RefreshCw, Upload, Shield, Settings } from 'lucide-react'
import { useRepoStore } from '../../store/repoStore'
import { ipc, IPC } from '../../hooks/useIpc'
import { useLangStore, useT } from '../../i18n/useT'
import { SettingsModal } from '../ui/SettingsModal'
import { WindowControls } from '../ui/WindowControls'
import { ProgressBar } from '../ui/ProgressBar'
import { ToastContainer } from '../ui/ToastContainer'
import { UpdateOverlay } from '../ui/UpdateOverlay'
import { useUpdater } from '../../hooks/useUpdater'
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
  const { currentRepo, health, changedFiles, selectedFiles, toggleFile, selectAll, commit, sync, isSyncing, branches } = useRepoStore()
  const { state: updater, checkForUpdates, installNow, dismiss } = useUpdater()
  const [message, setMessage] = useState('')
  const [committing, setCommitting] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [ueRunning, setUeRunning] = useState(false)
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
    if (!message.trim() || selectedFiles.length === 0) return
    setCommitting(true)
    await commit(message.trim(), false)
    setMessage('')
    setCommitting(false)
  }

  const handleSync = async () => {
    await sync()
  }

  const allSelected = changedFiles.length > 0 && selectedFiles.length === changedFiles.length

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
        <GitBranch size={11} strokeWidth={2} />
        <span className="compact-branch-name">{currentBranch?.name ?? '...'}</span>
        {behindBy > 0 && <span className="compact-badge compact-badge--behind">↓{behindBy}</span>}
        {aheadBy > 0 && <span className="compact-badge compact-badge--ahead">↑{aheadBy}</span>}
        <div style={{ flex: 1 }} />
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
          <div className="compact-empty">Keine Aenderungen</div>
        ) : (
          <>
            <div className="compact-files-header">
              <label className="compact-checkbox-row">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => selectAll(!allSelected)}
                />
                <span>Alle auswaehlen ({changedFiles.length})</span>
              </label>
            </div>
            <div className="compact-files-list">
              {changedFiles.map((f) => (
                <label key={f.path} className="compact-file-row">
                  <input
                    type="checkbox"
                    checked={selectedFiles.includes(f.path)}
                    onChange={() => toggleFile(f.path)}
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
          disabled={!message.trim() || selectedFiles.length === 0 || committing}
        >
          <Upload size={12} strokeWidth={2} />
          {committing ? 'Wird committet...' : `Commit (${selectedFiles.length})`}
        </button>
      </div>
    </div>
  )
}
