import { useEffect, useState } from 'react'
import { Shield, Settings } from 'lucide-react'
import { useRepoStore } from '../../store/repoStore'
import { ipc, IPC } from '../../hooks/useIpc'
import { SettingsModal } from '../ui/SettingsModal'
import { useLangStore, useT } from '../../i18n/useT'
import { toast } from '../../store/toastStore'
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
import './MainView.css'

const SIDEBAR_MIN = 160
const SIDEBAR_MAX = 400
const SIDEBAR_DEFAULT = 210

export function MainView() {
  const { currentRepo, health, refreshStatus, changedFiles } = useRepoStore()
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

    const offAvailable = window.deepcurrent.on(IPC.UPDATE_AVAILABLE as any, (version: unknown) => {
      toast.info(`Update v${version} verfügbar. Wird heruntergeladen…`, true)
    })
    const offDownloaded = window.deepcurrent.on(IPC.UPDATE_DOWNLOADED as any, (version: unknown) => {
      toast.ok(`Update v${version} bereit. Klicke zum Installieren.`, () => {
        window.deepcurrent.invoke(IPC.UPDATE_INSTALL_NOW as any)
      })
    })
    return () => { offAvailable(); offDownloaded() }
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
        </div>
        <WindowControls />
      </div>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

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
