import { useEffect, useState } from 'react'
import { Shield, Settings, Layers } from 'lucide-react'
import { useRepoStore } from '../../store/repoStore'
import { ipc, IPC } from '../../hooks/useIpc'
import { SettingsModal } from '../ui/SettingsModal'
import { useLangStore, useT } from '../../i18n/useT'
import type { AppSettings } from '../../../shared/types'

function applyFontSize(size: AppSettings['fontSize']) {
  const zoom = size === 'small' ? '0.88' : size === 'large' ? '1.14' : '1'
  ;(document.getElementById('root') as HTMLElement).style.zoom = zoom
}
import { SidebarPanel } from '../ui/SidebarPanel'
import { ChangesPanel } from '../ui/ChangesPanel'
import { CommitPanel } from '../ui/CommitPanel'
import { SyncPanel } from '../ui/SyncPanel'
import { TeamPanel } from '../ui/TeamPanel'
import { HistoryPanel } from '../ui/HistoryPanel'
import { HealthBar } from '../ui/HealthBar'
import { ToastContainer } from '../ui/ToastContainer'
import { ProgressBar } from '../ui/ProgressBar'
import { WindowControls } from '../ui/WindowControls'
import { UpdateOverlay } from '../ui/UpdateOverlay'
import { useUpdater } from '../../hooks/useUpdater'
import './MainView.css'

const SIDEBAR_MIN = 160
const SIDEBAR_MAX = 400
const SIDEBAR_DEFAULT = 210

interface Props {
  onSwitchToCompact: () => void
}

export function MainView({ onSwitchToCompact }: Props) {
  const { currentRepo, health, refreshStatus, changedFiles } = useRepoStore()
  const { state: updater, checkForUpdates, installNow, dismiss } = useUpdater()
  const [activeTab, setActiveTab] = useState<'changes' | 'sync' | 'history' | 'team'>('changes')
  const [ueRunning, setUeRunning] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth')
    return saved ? Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, parseInt(saved))) : SIDEBAR_DEFAULT
  })
  const { setLang } = useLangStore()
  const t = useT()

  const handleSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = sidebarWidth
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, startW + ev.clientX - startX))
      setSidebarWidth(next)
    }
    const onUp = (ev: MouseEvent) => {
      const next = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, startW + ev.clientX - startX))
      localStorage.setItem('sidebarWidth', String(next))
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  useEffect(() => {
    ipc.invoke<AppSettings>(IPC.SETTINGS_GET).then((s) => {
      if (s?.fontSize) applyFontSize(s.fontSize)
      if (s?.theme) document.documentElement.setAttribute('data-theme', s.theme)
      if (s?.language) setLang(s.language)
    })

    return () => {}
  }, [])

  useEffect(() => {
    if (!currentRepo) return
    const interval = setInterval(() => refreshStatus(), 10_000)
    return () => clearInterval(interval)
  }, [currentRepo, refreshStatus])

  useEffect(() => {
    const check = async () => {
      const running = await ipc.invoke<boolean>(IPC.UNREAL_IS_RUNNING)
      setUeRunning(!!running)
    }
    check()
    const interval = setInterval(check, 5000)
    return () => clearInterval(interval)
  }, [])

  if (!currentRepo) return null

  const isUnreal = health?.isUnrealProject ?? false

  return (
    <div className="main-layout-root">
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
      <div className="titlebar">
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
          <HealthBar compact />
          <button className="btn-icon titlebar-settings-btn" onClick={() => setSettingsOpen(true)} title="Einstellungen">
            <Settings size={14} strokeWidth={2} />
          </button>
          <button
            className="compact-mode-switch"
            onClick={onSwitchToCompact}
            title="Kompakt-Modus aktivieren"
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 8px 2px 10px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, WebkitAppRegion: 'no-drag' as any }}
          >
            <Layers size={11} strokeWidth={2} />
            <span style={{ fontSize: 11 }}>Pro</span>
            <span style={{ width: 26, height: 14, borderRadius: 7, background: 'var(--accent)', position: 'relative', flexShrink: 0, display: 'inline-block' }}>
              <span style={{ position: 'absolute', top: 2, right: 2, width: 10, height: 10, borderRadius: '50%', background: '#fff', display: 'block' }} />
            </span>
          </button>
        </div>
        <WindowControls />
      </div>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} onCheckUpdate={checkForUpdates} noUpdate={updater.noUpdate} />}

      <div className="main-body">
        {/* Sidebar */}
        <div className="sidebar" style={{ width: sidebarWidth }}>
          <SidebarPanel />
        </div>
        <div className="sidebar-resize-handle" onMouseDown={handleSidebarResize} />

        {/* Main content */}
        <div className="content">
          {/* Tab bar */}
          <div className="tab-bar">
            <button className={`tab-btn ${activeTab === 'changes' ? 'active' : ''}`} onClick={() => setActiveTab('changes')}>{t('tab_changes')}</button>
            <button className={`tab-btn ${activeTab === 'sync' ? 'active' : ''}`} onClick={() => setActiveTab('sync')}>{t('tab_sync')}</button>
            <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>{t('tab_history')}</button>
            <button className={`tab-btn ${activeTab === 'team' ? 'active' : ''}`} onClick={() => setActiveTab('team')}>{t('tab_team')}</button>
          </div>

          {/* Tab content */}
          <div className="tab-content">
            {activeTab === 'changes' && (
              <>
                <ChangesPanel />
                {changedFiles.length > 0 && <CommitPanel />}
              </>
            )}
            {activeTab === 'sync' && <SyncPanel />}
            {activeTab === 'history' && <HistoryPanel />}
            {activeTab === 'team' && (
              <div className="panel">
                <TeamPanel expanded />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
