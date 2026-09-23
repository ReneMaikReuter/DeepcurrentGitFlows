import { useState, useEffect } from 'react'
import { FolderOpen, Download, X, GitBranch, Search, Settings } from 'lucide-react'
import { SettingsModal } from '../ui/SettingsModal'
import { useRepoStore } from '../../store/repoStore'
import { ipc, IPC } from '../../hooks/useIpc'
import { useT } from '../../i18n/useT'
import { GitHubModal } from '../ui/GitHubModal'
import { WindowControls } from '../ui/WindowControls'
import { UpdateOverlay } from '../ui/UpdateOverlay'
import { useUpdater } from '../../hooks/useUpdater'
import type { Repository, RepositoryHealth } from '../../../shared/types'
import './WelcomeView.css'

export function WelcomeView() {
  const t = useT()
  const { savedRepos, loadSavedRepos, openRepository, isLoading, error, clearError } = useRepoStore()
  const { state: updater, checkForUpdates, installNow, dismiss } = useUpdater()
  const [showClone, setShowClone] = useState(false)
  const [showGitHub, setShowGitHub] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [repoSearch, setRepoSearch] = useState('')

  useEffect(() => {
    loadSavedRepos()
  }, [])

  const handleOpenDialog = async () => {
    clearError()
    const result = await (window.deepcurrent.invoke as any)('dialog:open-directory')
    if (result) await openRepository(result as string)
  }

  const handleOpen = async (repoPath: string) => {
    clearError()
    await openRepository(repoPath)
  }

  return (
    <div className="welcome">
      {(updater.updateAvailable || updater.updateDownloaded) && updater.version && !updater.dismissed && (
        <UpdateOverlay version={updater.version} downloadProgress={updater.downloadProgress} updateDownloaded={updater.updateDownloaded} onInstall={installNow} onDismiss={dismiss} />
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onCheckUpdate={checkForUpdates} noUpdate={updater.noUpdate} />}
      <div className="titlebar">
        <div className="titlebar-spacer" />
        <div className="titlebar-status">
          <button className="btn-icon titlebar-settings-btn" onClick={() => setShowSettings(true)} title="Einstellungen">
            <Settings size={14} strokeWidth={2} />
          </button>
        </div>
        <WindowControls />
      </div>
      {showGitHub && (
        <GitHubModal
          onClose={() => setShowGitHub(false)}
          onClone={(cloneUrl, repoName) => {
            setShowGitHub(false)
            setShowClone(true)
            // Pre-fill clone URL via a small hack: store it, ClonePanel reads it
            ;(window as any).__ghCloneUrl = cloneUrl
            ;(window as any).__ghRepoName = repoName
          }}
        />
      )}
      <div className="welcome-body"><div className="welcome-content">
        <div className="welcome-wordmark">
          <div className="welcome-app-name">Deepcurrent Git Flows</div>
          <div className="welcome-tagline">{t('welcome_tagline')}</div>
        </div>

        <div className="welcome-divider" />

        {error && <div className="error-banner">{error}</div>}

        {showClone ? (
          <ClonePanel onClose={() => setShowClone(false)} />
        ) : (
          <div className="welcome-actions">
            <button
              className="welcome-action-btn welcome-action-btn--primary"
              onClick={handleOpenDialog}
              disabled={isLoading}
            >
              <FolderOpen size={14} strokeWidth={2} />
              {t('welcome_open')}
            </button>
            <button
              className="welcome-action-btn"
              onClick={() => setShowClone(true)}
              disabled={isLoading}
            >
              <Download size={14} strokeWidth={2} />
              {t('welcome_clone')}
            </button>
            <button
              className="welcome-action-btn"
              onClick={() => setShowGitHub(true)}
              disabled={isLoading}
            >
              <GitBranch size={14} strokeWidth={2} />
              Von GitHub öffnen
            </button>
          </div>
        )}

        {savedRepos.length > 0 && !showClone && (
          <div className="recent-repos">
            <div className="recent-repos-header">
              <span className="recent-repos-label">{t('welcome_recent')}</span>
            </div>
            {savedRepos.length > 4 && (
              <div className="recent-repos-search">
                <Search size={12} className="recent-repos-search-icon" />
                <input
                  className="recent-repos-search-input"
                  placeholder="Suchen…"
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                />
              </div>
            )}
            <div className="recent-repos-list">
              {savedRepos
                .filter((r) => !repoSearch || r.name.toLowerCase().includes(repoSearch.toLowerCase()) || r.path.toLowerCase().includes(repoSearch.toLowerCase()))
                .map((repo) => (
                  <button
                    key={repo.id}
                    className="recent-repo-item"
                    onClick={() => handleOpen(repo.path)}
                    disabled={isLoading}
                  >
                    <div className="recent-repo-name">{repo.name}</div>
                    <div className="recent-repo-path truncate">{repo.path}</div>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div></div>
    </div>
  )
}

interface ClonePanelProps {
  onClose: () => void
}

function ClonePanel({ onClose }: ClonePanelProps) {
  const { openRepository } = useRepoStore()
  const prefillUrl = typeof window !== 'undefined' ? ((window as any).__ghCloneUrl ?? '') : ''
  const [url, setUrl] = useState(prefillUrl as string)
  const [targetDir, setTargetDir] = useState('')
  const [cloning, setCloning] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handlePickDir = async () => {
    const result = await (window.deepcurrent.invoke as any)('dialog:open-directory')
    if (result) setTargetDir(result as string)
  }

  const handleClone = async () => {
    if (!url.trim() || !targetDir.trim()) return
    setCloning(true)
    setError(null)
    setProgress('Cloning repository…')

    const result = await ipc.invoke<{
      success: boolean
      repository?: Repository
      health?: RepositoryHealth
      clonedPath?: string
      error?: string
    }>(IPC.REPO_CLONE, url.trim(), targetDir.trim())

    setCloning(false)
    setProgress(null)

    if (!result.success) {
      setError(result.error ?? 'Clone failed.')
      return
    }

    // Open the freshly cloned repo
    if (result.clonedPath) {
      await openRepository(result.clonedPath)
    }
  }

  const urlValid = /^(https?:\/\/|git@|git:\/\/)/.test(url.trim())
  const canClone = urlValid && targetDir.trim().length > 0 && !cloning

  return (
    <div className="clone-panel">
      <div className="clone-panel-header">
        <span className="clone-panel-title">Clone Repository</span>
        <button className="btn-icon" onClick={onClose} title="Cancel">
          <X size={14} strokeWidth={2} />
        </button>
      </div>

      <div className="clone-field">
        <label className="clone-label">Repository URL</label>
        <input
          type="text"
          placeholder="https://github.com/org/repo.git"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && canClone) handleClone() }}
          disabled={cloning}
          autoFocus
          spellCheck={false}
        />
        {url.trim().length > 0 && !urlValid && (
          <span className="clone-hint-error">Must start with https://, git@, or git://</span>
        )}
      </div>

      <div className="clone-field">
        <label className="clone-label">Clone into</label>
        <div className="clone-dir-row">
          <input
            type="text"
            placeholder="Choose folder…"
            value={targetDir}
            onChange={(e) => setTargetDir(e.target.value)}
            disabled={cloning}
            readOnly
            style={{ cursor: 'pointer' }}
            onClick={handlePickDir}
          />
          <button className="btn btn-secondary btn-sm clone-dir-btn" onClick={handlePickDir} disabled={cloning}>
            Browse
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {cloning && (
        <div className="clone-progress">
          <span className="sync-spinner" />
          <span>{progress}</span>
        </div>
      )}

      <div className="clone-actions">
        <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={cloning}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={handleClone}
          disabled={!canClone}
        >
          {cloning ? 'Cloning…' : 'Clone'}
        </button>
      </div>
    </div>
  )
}
