import { useState, useEffect } from 'react'
import { Check, RefreshCw, Plus, Minus, AlertTriangle, Upload, ChevronDown, ChevronRight, RotateCcw, Lock, History, GitPullRequest } from 'lucide-react'
import { useRepoStore } from '../../store/repoStore'
import { ipc, IPC } from '../../hooks/useIpc'
import { useT } from '../../i18n/useT'
import { toast } from '../../store/toastStore'
import type { ChangedFile, LfsLock } from '../../../shared/types'
import { DiffViewer } from './DiffViewer'
import { StashPanel } from './StashPanel'
import { PrCreateModal } from './PrCreateModal'
import './ChangesPanel.css'

interface FileLogEntry {
  hash: string
  author: string
  email: string
  date: string
  message: string
}

function FileHistoryModal({ filePath, repoPath, onClose }: { filePath: string; repoPath: string; onClose: () => void }) {
  const [entries, setEntries] = useState<FileLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ipc.invoke<FileLogEntry[]>(IPC.GIT_FILE_LOG, repoPath, filePath).then((data) => {
      setEntries(data ?? [])
      setLoading(false)
    })
  }, [repoPath, filePath])

  return (
    <div className="file-history-overlay" onClick={onClose}>
      <div className="file-history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="file-history-header">
          <History size={14} strokeWidth={1.8} />
          <span className="file-history-title truncate">{filePath.split(/[\\/]/).pop()}</span>
          <button className="btn-icon btn-sm" onClick={onClose} style={{ marginLeft: 'auto' }}>✕</button>
        </div>
        <div className="file-history-list">
          {loading && <div className="file-history-empty">Lade…</div>}
          {!loading && entries.length === 0 && <div className="file-history-empty">Keine Historie gefunden.</div>}
          {entries.map((e) => (
            <div key={e.hash} className="file-history-entry">
              <span className="file-history-hash">{e.hash}</span>
              <span className="file-history-message truncate">{e.message}</span>
              <span className="file-history-author truncate">{e.author}</span>
              <span className="file-history-date">{new Date(e.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function formatSize(bytes: number | null): string {
  if (bytes === null) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`
  return `${(bytes / 1024 / 1024).toFixed(1)}M`
}

export function ChangesPanel() {
  const t = useT()
  const { changedFiles, selectedFiles, selectAllFiles, deselectAllFiles, refreshStatus, refreshBranches, stageFiles, unstageFiles, currentRepo, currentBranch, branches } = useRepoStore()

  // Refresh branches on mount so aheadBy reflects recent merges
  useEffect(() => {
    refreshBranches()
  }, [currentRepo?.path])

  const [lockedByOthers, setLockedByOthers] = useState<Set<string>>(new Set())
  const [lockedByMe, setLockedByMe] = useState<Set<string>>(new Set())
  const [historyFile, setHistoryFile] = useState<string | null>(null)
  const [selectedDiffFile, setSelectedDiffFile] = useState<ChangedFile | null>(null)
  const [showPrModal, setShowPrModal] = useState(false)

  const refreshLocks = async () => {
    if (!currentRepo) return
    const [locks, user] = await Promise.all([
      ipc.invoke<LfsLock[]>(IPC.LFS_LIST_LOCKS, currentRepo.path),
      ipc.invoke<{ login: string } | null>(IPC.GITHUB_GET_USER),
    ]).catch(() => [[], null] as [LfsLock[], null])
    const myLogin = (user as { login: string } | null)?.login ?? null
    const allLocks: LfsLock[] = Array.isArray(locks) ? locks : []
    setLockedByOthers(new Set(allLocks.filter((l) => myLogin ? l.owner !== myLogin : false).map((l) => l.path)))
    setLockedByMe(new Set(allLocks.filter((l) => myLogin ? l.owner === myLogin : true).map((l) => l.path)))
  }

  useEffect(() => { refreshLocks() }, [currentRepo?.path, changedFiles.length])

  const [revertingSelected, setRevertingSelected] = useState(false)
  const [revertConfirm, setRevertConfirm] = useState(false)

  const handleRevertSelected = async () => {
    if (!revertConfirm) {
      setRevertConfirm(true)
      setTimeout(() => setRevertConfirm(false), 3000)
      return
    }
    if (!currentRepo || selectedFiles.size === 0) return
    setRevertingSelected(true)
    await ipc.invoke(IPC.CHANGES_DISCARD, currentRepo.path, [...selectedFiles], true)
    setRevertingSelected(false)
    setRevertConfirm(false)
    deselectAllFiles()
    await refreshStatus()
  }

  const staged   = changedFiles.filter((f) => f.isStaged)
  const unstaged = changedFiles.filter((f) => !f.isStaged)

  const currentBranchInfo = branches.find((b) => b.isCurrent && !b.isRemote)
  const aheadBy = currentBranchInfo?.aheadBy ?? 0
  const upstream = currentBranchInfo?.upstream ?? null

  const [aheadFiles, setAheadFiles] = useState<string[]>([])
  const [filesExpanded, setFilesExpanded] = useState(true)

  useEffect(() => {
    if (!currentRepo || aheadBy === 0) { setAheadFiles([]); return }
    const ref = upstream ?? `origin/${currentBranch}`
    ipc.invoke<string[]>(IPC.BRANCH_AHEAD_FILES, currentRepo.path, currentBranch ?? '', ref)
      .then((files) => setAheadFiles(files ?? []))
  }, [currentRepo?.path, currentBranch, aheadBy, upstream])

  const [isPushing, setIsPushing] = useState(false)
  const [pushPercent, setPushPercent] = useState<number | null>(null)

  useEffect(() => {
    const off = window.deepcurrent.on(IPC.PUSH_PROGRESS as any, (pct: unknown) => {
      if (pct === null) { setPushPercent(null); setIsPushing(false) }
      else { setPushPercent(pct as number); setIsPushing(true) }
    })
    return () => off()
  }, [])

  const handlePush = async () => {
    if (!currentRepo || !currentBranch) return
    setIsPushing(true)
    setPushPercent(0)
    const res = await ipc.invoke<{ success: boolean; error: string | null; remoteHasNewCommits?: boolean }>(IPC.BRANCH_PUSH, currentRepo.path, currentBranch)
    setIsPushing(false)
    setPushPercent(null)
    if (res && !res.success) {
      if (res.remoteHasNewCommits) {
        toast.err('Remote hat neue Commits. Bitte erst Sync, dann Push.')
      } else {
        toast.err(res.error ?? 'Push fehlgeschlagen.')
      }
    } else if (res?.success) {
      toast.ok('Push erfolgreich.')
    }
    await refreshStatus()
  }

  if (changedFiles.length === 0) {
    // If there are commits ready to push, show them as a full file list
    if (aheadBy > 0) {
      return (
        <div className="changes-panel">
          <div className="changes-toolbar">
            <span className="changes-title">{t('changes_ready_push')}</span>
            <span className="changes-count-badge">{aheadBy} Commit{aheadBy !== 1 ? 's' : ''}</span>
            <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={handlePush} disabled={isPushing}>
              <Upload size={11} strokeWidth={2} />
              {isPushing ? (pushPercent !== null && pushPercent > 0 ? `${pushPercent}%` : 'Push…') : 'Push'}
            </button>
            <button className="btn-icon" title={t('changes_refresh')} onClick={refreshStatus}>
              <RefreshCw size={12} strokeWidth={2} />
            </button>
          </div>
          {isPushing && (
            <div className="git-progress-bar-wrap">
              <div className="git-progress-bar" style={{ width: `${pushPercent ?? 5}%` }} />
            </div>
          )}
          {aheadFiles.length > 0 && (
            <div className="changes-list">
              <div className="changes-group">
                <div className="changes-group-header">
                  <span className="changes-group-label">{t('changes_merged_files')}</span>
                  <span className="changes-group-count">{aheadFiles.length}</span>
                  <div className="changes-group-actions">
                    <button
                      className="changes-ahead-files-toggle btn btn-ghost btn-sm"
                      onClick={() => setFilesExpanded((v) => !v)}
                    >
                      {filesExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                    </button>
                  </div>
                </div>
                {filesExpanded && aheadFiles.map((f) => (
                  <div key={f} className="file-row" title={f}>
                    <span className="file-status M" style={{ color: 'var(--accent)' }}>↑</span>
                    <span className="file-path truncate">{f}</span>
                    <span className="file-size">{f.split('/').pop()?.split('.').pop()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="changes-empty">
        <div className="changes-empty-icon">
          <Check size={16} strokeWidth={2} color="var(--success)" />
        </div>
        <div className="changes-empty-text">{t('changes_none')}</div>
        <button className="btn btn-ghost btn-sm" onClick={async () => { await refreshBranches(); await refreshStatus() }}>
          <RefreshCw size={11} strokeWidth={2} />
          {t('changes_refresh')}
        </button>
      </div>
    )
  }

  return (
    <div className="changes-split-root">
      {historyFile && currentRepo && (
        <FileHistoryModal filePath={historyFile} repoPath={currentRepo.path} onClose={() => setHistoryFile(null)} />
      )}
      {showPrModal && currentRepo && currentBranch && (
        <PrCreateModal
          repoPath={currentRepo.path}
          currentBranch={currentBranch}
          branches={branches}
          onClose={() => setShowPrModal(false)}
        />
      )}

      {/* Left: file list + stash */}
      <div className="changes-list-side">
        <div className="changes-toolbar">
          <span className="changes-title">{t('changes_title')}</span>
          <span className="changes-count-badge">{changedFiles.length}</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={selectedFiles.size > 0 ? deselectAllFiles : selectAllFiles}
          >
            {selectedFiles.size > 0 ? t('changes_deselect_all') : t('changes_select_all')}
          </button>
          {selectedFiles.size > 0 && (
            <button
              className={`btn btn-sm ${revertConfirm ? 'btn-danger' : 'btn-ghost'}`}
              onClick={handleRevertSelected}
              disabled={revertingSelected}
            >
              <RotateCcw size={11} strokeWidth={2} />
              {revertConfirm ? t('changes_discard_confirm') : `${selectedFiles.size} ${t('changes_discard_selected')}`}
            </button>
          )}
          <button className="btn-icon" title="Pull Request erstellen" onClick={() => setShowPrModal(true)}>
            <GitPullRequest size={12} strokeWidth={2} />
          </button>
          <button className="btn-icon" title={t('changes_refresh')} onClick={async () => { await refreshBranches(); await refreshStatus() }}>
            <RefreshCw size={12} strokeWidth={2} />
          </button>
        </div>

        <div className="changes-list">
          {staged.length > 0 && (
            <div className="changes-group">
              <div className="changes-group-header">
                <span className="changes-group-label">{t('changes_staged')}</span>
                <span className="changes-group-count">{staged.length}</span>
                <div className="changes-group-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => unstageFiles(staged.map((f) => f.path))}>
                    {t('changes_unstage_all')}
                  </button>
                </div>
              </div>
              {staged.map((f) => (
                <FileRow
                  key={f.path}
                  file={f}
                  isLockedByOther={lockedByOthers.has(f.path)}
                  isLockedByMe={lockedByMe.has(f.path)}
                  onShowHistory={setHistoryFile}
                  onLockToggled={refreshLocks}
                  onSelectDiff={setSelectedDiffFile}
                  isSelectedDiff={selectedDiffFile?.path === f.path}
                />
              ))}
            </div>
          )}

          {unstaged.length > 0 && (
            <div className="changes-group">
              <div className="changes-group-header">
                <span className="changes-group-label">{t('changes_unstaged')}</span>
                <span className="changes-group-count">{unstaged.length}</span>
                <div className="changes-group-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => stageFiles(unstaged.map((f) => f.path))}>
                    {t('changes_stage_all')}
                  </button>
                </div>
              </div>
              {unstaged.map((f) => (
                <FileRow
                  key={f.path}
                  file={f}
                  isLockedByOther={lockedByOthers.has(f.path)}
                  isLockedByMe={lockedByMe.has(f.path)}
                  onShowHistory={setHistoryFile}
                  onLockToggled={refreshLocks}
                  onSelectDiff={setSelectedDiffFile}
                  isSelectedDiff={selectedDiffFile?.path === f.path}
                />
              ))}
            </div>
          )}
        </div>

        {currentRepo && (
          <StashPanel repoPath={currentRepo.path} onStashChange={refreshStatus} />
        )}
      </div>

      {/* Right: diff viewer */}
      {currentRepo && (
        <DiffViewer repoPath={currentRepo.path} file={selectedDiffFile} />
      )}
    </div>
  )
}

function FileRow({ file, isLockedByOther, isLockedByMe, onShowHistory, onLockToggled, onSelectDiff, isSelectedDiff }: {
  file: ChangedFile
  isLockedByOther: boolean
  isLockedByMe: boolean
  onShowHistory: (path: string) => void
  onLockToggled: () => void
  onSelectDiff?: (file: ChangedFile) => void
  isSelectedDiff?: boolean
}) {
  const { selectedFiles, toggleFileSelection, stageFiles, unstageFiles, currentRepo, refreshStatus } = useRepoStore()
  const isSelected = selectedFiles.has(file.path)
  const [confirmRevert, setConfirmRevert] = useState(false)
  const [lockWorking, setLockWorking] = useState(false)

  const handleToggleLock = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!currentRepo || lockWorking) return
    setLockWorking(true)
    if (isLockedByMe) {
      await ipc.invoke(IPC.LFS_UNLOCK, currentRepo.path, file.path, false)
    } else {
      await ipc.invoke(IPC.LFS_LOCK, currentRepo.path, file.path)
    }
    await onLockToggled()
    setLockWorking(false)
  }

  const handleRevert = async () => {
    if (!confirmRevert) { setConfirmRevert(true); setTimeout(() => setConfirmRevert(false), 3000); return }
    if (!currentRepo) return
    await ipc.invoke(IPC.CHANGES_DISCARD, currentRepo.path, [file.path], true)
    await refreshStatus()
    setConfirmRevert(false)
  }

  const STATUS_CHAR: Record<string, string> = {
    modified: 'M', added: 'A', deleted: 'D', renamed: 'R',
    untracked: '?', conflicted: 'C', ignored: 'I',
  }
  const statusChar = STATUS_CHAR[file.status] ?? '?'

  return (
    <div
      className={`file-row ${isSelected ? 'selected' : ''} ${file.status === 'conflicted' ? 'conflicted' : ''} ${isSelectedDiff ? 'file-row--diff-active' : ''}`}
      onClick={() => { toggleFileSelection(file.path); onSelectDiff?.(file) }}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => toggleFileSelection(file.path)}
        onClick={(e) => e.stopPropagation()}
        className="file-checkbox"
      />

      <span className={`file-status ${statusChar}`}>{statusChar}</span>

      <span className="file-path truncate">
        {file.status === 'renamed' && file.oldPath ? (
          <>{file.oldPath}<span className="file-rename-arrow">→</span>{file.path}</>
        ) : (
          file.path
        )}
      </span>

      <div className="file-tags">
        {isLockedByOther && (
          <span className="badge badge-warning" title="Gesperrt von einem anderen Teammitglied">
            <Lock size={9} strokeWidth={2.5} style={{ display: 'inline', marginRight: 2 }} />
            GESPERRT
          </span>
        )}
        {file.isLfsPointer && (
          <span className="badge badge-pointer" title="LFS pointer. Actual file not downloaded.">
            <AlertTriangle size={9} strokeWidth={2.5} style={{ display: 'inline', marginRight: 2 }} />
            POINTER
          </span>
        )}
        {file.isUnrealAsset && !file.isLfsPointer && (
          <span className="badge badge-unreal">
            {file.assetType === 'umap' ? 'map' : file.assetType ?? 'asset'}
          </span>
        )}
        {file.isLfsTracked && !file.isLfsPointer && (
          <span className="badge badge-lfs">LFS</span>
        )}
      </div>

      {file.fileSizeBytes !== null && (
        <span className="file-size">{formatSize(file.fileSizeBytes)}</span>
      )}

      <div className="file-actions" onClick={(e) => e.stopPropagation()}>
        {(file.isLfsTracked || file.isUnrealAsset) && !isLockedByOther && (
          <button
            className={`btn-icon btn-sm file-lock-btn${isLockedByMe ? ' file-lock-btn--locked' : ''}`}
            title={isLockedByMe ? 'Sperre aufheben' : 'Asset sperren'}
            onClick={handleToggleLock}
            disabled={lockWorking}
          >
            <Lock size={11} strokeWidth={2} />
          </button>
        )}
        <button className="btn-icon btn-sm file-history-btn" title="Datei-Historie anzeigen" onClick={() => onShowHistory(file.path)}>
          <History size={11} strokeWidth={2} />
        </button>
        {confirmRevert ? (
          <button className="btn-icon btn-sm file-revert-confirm" title="Klicke nochmal zum Bestätigen" onClick={handleRevert}>
            <RotateCcw size={12} strokeWidth={2.5} />
          </button>
        ) : (
          <button className="btn-icon btn-sm file-revert-btn" title="Änderungen verwerfen" onClick={handleRevert}>
            <RotateCcw size={12} strokeWidth={2.5} />
          </button>
        )}
        {file.isStaged ? (
          <button className="btn-icon btn-sm" title="Unstage" onClick={() => unstageFiles([file.path])}>
            <Minus size={12} strokeWidth={2.5} />
          </button>
        ) : (
          <button className="btn-icon btn-sm" title="Stage" onClick={() => stageFiles([file.path])}>
            <Plus size={12} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  )
}
