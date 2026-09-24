import { useEffect, useState } from 'react'
import { GitBranch, RefreshCw, Upload, Shield, Settings, ChevronDown, Users } from 'lucide-react'
import { useRepoStore } from '../../store/repoStore'
import { ipc, IPC } from '../../hooks/useIpc'
import { useLangStore, useT } from '../../i18n/useT'
import { SettingsModal } from '../ui/SettingsModal'
import { BranchSwitchModal } from '../ui/BranchSwitchModal'
import { WindowControls } from '../ui/WindowControls'
import { HealthBar } from '../ui/HealthBar'
import { ProgressBar } from '../ui/ProgressBar'
import { ToastContainer } from '../ui/ToastContainer'
import { UpdateOverlay } from '../ui/UpdateOverlay'
import { useUpdater } from '../../hooks/useUpdater'
import { toast } from '../../store/toastStore'
import { TeamPanel } from '../ui/TeamPanel'
import { TutorialOverlay } from '../ui/TutorialOverlay'
import { useTutorialStore, DEMO_REPO, DEMO_BRANCHES, DEMO_FILES, DEMO_HEALTH } from '../../store/tutorialStore'
import { TUTORIAL_STEPS } from '../ui/tutorialSteps'
import type { AppSettings } from '../../../shared/types'
import './CompactView.css'

function applyFontSize(size: AppSettings['fontSize']) {
  const zoom = size === 'small' ? '0.88' : size === 'large' ? '1.14' : '1'
  const root = document.getElementById('root') as HTMLElement | null
  if (root && root.style.zoom !== zoom) root.style.zoom = zoom
}

interface Props {
  onSwitchToPro: () => void
  active?: boolean
}

export function CompactView({ onSwitchToPro, active = true }: Props) {
  const tutorial = useTutorialStore()
  const isTutorial = tutorial.active

  const realStore = useRepoStore()
  const { state: updater, checkForUpdates, installNow, dismiss } = useUpdater()
  const [message, setMessage] = useState('')
  const [committing, setCommitting] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [ueRunning, setUeRunning] = useState(false)
  const [branchMenuOpen, setBranchMenuOpen] = useState(false)
  const [switchModal, setSwitchModal] = useState<string | null>(null)
  const [switching, setSwitching] = useState(false)
  const [activeTab, setActiveTab] = useState<'changes' | 'team'>('changes')
  const { setLang } = useLangStore()
  const t = useT()

  // When tutorial is active, use demo data
  const currentRepo = isTutorial ? DEMO_REPO : realStore.currentRepo
  const health = isTutorial ? DEMO_HEALTH : realStore.health
  const changedFiles = isTutorial ? DEMO_FILES : realStore.changedFiles
  const branches = isTutorial ? DEMO_BRANCHES : realStore.branches
  const isSyncing = isTutorial ? false : realStore.isSyncing
  const selectedFiles = isTutorial ? tutorial.selectedFilePaths : realStore.selectedFiles

  const toggleFileSelection = (path: string) => {
    if (isTutorial) {
      const next = new Set(tutorial.selectedFilePaths)
      if (next.has(path)) next.delete(path); else next.add(path)
      tutorial.setSelectedFilePaths(next)
    } else {
      realStore.toggleFileSelection(path)
    }
  }
  const selectAllFiles = () => {
    if (isTutorial) tutorial.setSelectedFilePaths(new Set(DEMO_FILES.map((f) => f.path)))
    else realStore.selectAllFiles()
  }
  const deselectAllFiles = () => {
    if (isTutorial) tutorial.setSelectedFilePaths(new Set())
    else realStore.deselectAllFiles()
  }

  // Apply tutorial-driven UI state when step changes
  useEffect(() => {
    if (!isTutorial) return
    const step = TUTORIAL_STEPS[tutorial.step]
    if (!step.uiState) return
    const s = step.uiState
    if (s.branchMenuOpen !== undefined) setBranchMenuOpen(s.branchMenuOpen)
    if (s.activeTab !== undefined) setActiveTab(s.activeTab)
    if (s.commitMessage !== undefined) setMessage(s.commitMessage)
    if (s.selectAllFiles !== undefined) {
      if (s.selectAllFiles) tutorial.setSelectedFilePaths(new Set(DEMO_FILES.map((f) => f.path)))
      else tutorial.setSelectedFilePaths(new Set())
    }
    if (s.ueRunning !== undefined) setUeRunning(s.ueRunning)
  }, [isTutorial, tutorial.step])

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
    if (!active) return
    const check = async () => {
      const running = await ipc.invoke<boolean>(IPC.UNREAL_IS_RUNNING)
      setUeRunning(!!running)
    }
    check()
    const i = setInterval(check, 5000)
    return () => clearInterval(i)
  }, [active])

  const handleCommit = async () => {
    if (!message.trim() || selectedFiles.size === 0) return
    if (isTutorial) { toast.ok('Tutorial: Commit simuliert.'); setMessage(''); return }
    setCommitting(true)
    await realStore.commit(message.trim(), false)
    setMessage('')
    setCommitting(false)
  }

  const handleSync = async () => {
    if (isTutorial) { toast.ok('Tutorial: Sync simuliert.'); return }
    await realStore.startSync()
  }

  const handlePush = async () => {
    if (!currentRepo || !currentBranch?.name) return
    if (isTutorial) { toast.ok('Tutorial: Push simuliert.'); return }
    setPushing(true)
    const res = await ipc.invoke<{ success: boolean; error: string | null }>(IPC.BRANCH_PUSH, currentRepo.path, currentBranch.name)
    setPushing(false)
    if (res.success) toast.ok('Gepusht.')
    else toast.err(res.error ?? 'Push fehlgeschlagen.')
  }

  const handleBranchSwitch = async (name: string) => {
    setBranchMenuOpen(false)
    if (name === currentBranch?.name) return
    if (isTutorial) { toast.ok(`Tutorial: Branch „${name}" gewählt.`); return }
    setSwitching(true)
    const result = await realStore.switchBranch(name)
    setSwitching(false)
    if (result.requiresAction) setSwitchModal(name)
    else if (result.error) toast.err(result.error)
  }

  const allSelected = changedFiles.length > 0 && selectedFiles.size === changedFiles.length

  if (!currentRepo && !isTutorial) return null

  return (
    <div className="compact-root">
      {isTutorial && <TutorialOverlay />}
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
        <span className="titlebar-repo truncate" data-tid="repo-name">{currentRepo?.name ?? 'EchoesOfMyran-Demo'}</span>
        <div className="titlebar-spacer" />
        <div className="titlebar-status">
          {(isUnreal && ueRunning) && (
            <span className="titlebar-safe-mode" data-tid="safe-mode">
              <Shield size={11} strokeWidth={2.5} />
              {t('unreal_safe_mode')}
            </span>
          )}
          <span data-tid="health-bar"><HealthBar compact /></span>
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
            data-tid="branch-btn"
          >
            <GitBranch size={11} strokeWidth={2} />
            <span className="compact-branch-name">{currentBranch?.name ?? '...'}</span>
            <ChevronDown size={10} strokeWidth={2} />
          </button>
          {branchMenuOpen && (
            <div className="compact-branch-dropdown" data-tid="branch-dropdown">
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
          data-tid="sync-btn"
        >
          <RefreshCw size={11} strokeWidth={2} className={isSyncing ? 'spin' : ''} />
          Sync
        </button>
      </div>

      {/* Tab bar */}
      <div className="compact-tabs">
        <button className={`compact-tab ${activeTab === 'changes' ? 'active' : ''}`} onClick={() => setActiveTab('changes')} data-tid="changes-tab">
          Änderungen
        </button>
        <button className={`compact-tab ${activeTab === 'team' ? 'active' : ''}`} onClick={() => setActiveTab('team')} data-tid="team-tab">
          <Users size={11} strokeWidth={2} style={{ display: 'inline', marginRight: 4 }} />
          Team
        </button>
      </div>

      {/* Team tab */}
      {activeTab === 'team' && (
        <div className="compact-team">
          <TeamPanel />
        </div>
      )}

      {/* File list */}
      <div className="compact-files" style={{ display: activeTab === 'changes' ? undefined : 'none' }} data-tid="file-list">
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
      {activeTab === 'changes' && <div className="compact-commit" data-tid="commit-area">
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
      </div>}
    </div>
  )
}
