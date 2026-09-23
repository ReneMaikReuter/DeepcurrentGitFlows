import { useState, useEffect } from 'react'
import { RefreshCw, X, AlertTriangle, Shield, Download } from 'lucide-react'
import { useRepoStore } from '../../store/repoStore'
import { ipc, IPC } from '../../hooks/useIpc'
import { BackupRestoreModal } from './BackupRestoreModal'
import { toast } from '../../store/toastStore'
import { useT } from '../../i18n/useT'
import type { SyncStep } from '../../../shared/types'
import './SyncPanel.css'

export function SyncPanel() {
  const t = useT()
  const { syncState, isSyncing, startSync, cancelSync, currentRepo, health, refreshBranches } = useRepoStore()

  const [showBackups, setShowBackups] = useState(false)
  const [ueRunning, setUeRunning] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [fetchPercent, setFetchPercent] = useState<number | null>(null)

  useEffect(() => {
    const off = window.deepcurrent.on(IPC.FETCH_PROGRESS as any, (pct: unknown) => {
      if (pct === null) setFetchPercent(null)
      else setFetchPercent(pct as number)
    })
    return () => off()
  }, [])

  const handleFetch = async () => {
    if (!currentRepo) return
    setFetching(true)
    const res = await ipc.invoke<{ success: boolean; error: string | null }>(IPC.FETCH, currentRepo.path)
    setFetching(false)
    if (res.success) {
      await refreshBranches()
      toast.ok('Fetch abgeschlossen. Remote-Stand aktualisiert.')
    } else {
      toast.err(res.error ?? 'Fetch fehlgeschlagen.')
    }
  }

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

  const isDone   = syncState?.phase === 'done'
  const isFailed = syncState?.phase === 'failed'
  const isUnreal = health?.isUnrealProject ?? false

  return (
    <div className="sync-panel">
      {showBackups && (
        <BackupRestoreModal onClose={() => setShowBackups(false)} />
      )}

      {/* Idle state */}
      {!isSyncing && !isFailed && (
        <div className="sync-hero">
          <div className="sync-hero-header">
            <span className="sync-hero-title">
              {isDone ? t('sync_title_done') : t('sync_title_idle')}
            </span>
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <button className="btn-sync" onClick={handleFetch} disabled={fetching} title={t('sync_description')}>
                <Download size={13} strokeWidth={2.5} />
                {fetching
                  ? (fetchPercent !== null && fetchPercent > 0 ? `${fetchPercent}%` : t('sync_fetching'))
                  : t('sync_fetch_btn')}
              </button>
              <button className="btn-sync" onClick={startSync} title={t('sync_btn_tooltip')}>
                <RefreshCw size={13} strokeWidth={2.5} />
                {t('sync_btn')}
              </button>
            </div>
          </div>
          {fetching && (
            <div className="git-progress-bar-wrap">
              <div className="git-progress-bar" style={{ width: `${fetchPercent ?? 5}%` }} />
            </div>
          )}
          <p className="sync-description">{t('sync_description')}</p>
        </div>
      )}

      {/* Unreal Editor detection */}
      {isUnreal && !isSyncing && !isFailed && ueRunning && (
        <UnrealSyncInfo />
      )}

      {/* Active / completed progress */}
      {(isSyncing || syncState) && (
        <div className="sync-progress">
          <div className="sync-progress-header">
            <span className="sync-progress-title">
              {isDone ? t('sync_title_done') : isFailed ? t('sync_title_failed') : t('sync_title_running')}
            </span>
            {isSyncing && (
              <button className="btn btn-ghost btn-sm" onClick={cancelSync}>
                <X size={12} strokeWidth={2} />
                {t('sync_cancel')}
              </button>
            )}
          </div>

          {syncState?.steps.map((step) => <StepRow key={step.id} step={step} />)}

          {/* Error */}
          {isFailed && syncState?.error && (
            <div className="sync-error-box">
              <div className="sync-error-title">{syncState.error.humanMessage}</div>
              {syncState.error.affectedFiles.length > 0 && (
                <ul className="sync-error-files">
                  {syncState.error.affectedFiles.map((f) => (
                    <li key={f} className="sync-error-file">{f}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Conflicts */}
          {syncState?.conflicts && syncState.conflicts.length > 0 && (
            <ConflictList />
          )}

          {/* LFS pointer problems */}
          {syncState?.lfsProblems && syncState.lfsProblems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
              <span className="sync-lfs-section-label">LFS Pointer Problems</span>
              {syncState.lfsProblems.map((p) => (
                <div key={p.path} className="lfs-problem-row">
                  <span className="lfs-problem-path truncate">{p.path}</span>
                  <span className="lfs-problem-sizes">
                    {formatSize(p.expectedSizeBytes)} expected · {formatSize(p.actualSizeBytes)} actual
                  </span>
                </div>
              ))}
            </div>
          )}

          {isFailed && (
            <button className="btn-sync" style={{ marginTop: 'var(--sp-4)' }} onClick={startSync}>
              <RefreshCw size={13} strokeWidth={2.5} />
              {t('sync_retry')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function StepRow({ step }: { step: SyncStep }) {
  return (
    <div className={`sync-step sync-step--${step.status}`}>
      <span className={`sync-step-indicator`} />
      <span className="sync-step-label">{step.label}</span>
      {step.detail && <span className="sync-step-detail">{step.detail}</span>}
      {step.status === 'running' && <span className="sync-spinner" />}
    </div>
  )
}

function ConflictList() {
  const { syncState, currentRepo } = useRepoStore()

  const handleResolve = async (path: string, resolution: 'keep-mine' | 'keep-remote' | 'abort') => {
    if (!currentRepo) return
    await ipc.invoke(IPC.CONFLICT_RESOLVE, currentRepo.path, { path, resolution })
  }

  return (
    <div className="conflict-list">
      <span className="conflict-section-label">Conflicts</span>
      {syncState?.conflicts.map((conflict) => (
        <div key={conflict.path} className="conflict-item">
          <div className="conflict-path truncate">{conflict.path}</div>
          {conflict.isUnrealAsset && (
            <div className="conflict-warning">
              <AlertTriangle size={12} strokeWidth={2} />
              Binary Unreal asset. Cannot be auto-merged.
            </div>
          )}
          <div className="conflict-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => handleResolve(conflict.path, 'keep-mine')}>
              Keep mine
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleResolve(conflict.path, 'keep-remote')}>
              Keep remote
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => handleResolve(conflict.path, 'abort')}>
              Abort
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function UnrealSyncInfo() {
  const t = useT()
  return (
    <div className="sync-unreal-warning">
      <Shield size={14} strokeWidth={2} style={{ color: 'var(--unreal-accent)', flexShrink: 0, marginTop: 1 }} />
      <div className="sync-unreal-warning-text">
        <div className="sync-unreal-warning-title">{t('sync_unreal_title')}</div>
        <div className="sync-unreal-warning-desc">{t('sync_unreal_desc')}</div>
      </div>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
