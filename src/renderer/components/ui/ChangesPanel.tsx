import { useState, useEffect } from 'react'
import { Check, RefreshCw, Plus, Minus, AlertTriangle, Upload, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'
import { useRepoStore } from '../../store/repoStore'
import { ipc, IPC } from '../../hooks/useIpc'
import { useT } from '../../i18n/useT'
import type { ChangedFile } from '../../../shared/types'
import './ChangesPanel.css'

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
    await ipc.invoke(IPC.BRANCH_PUSH, currentRepo.path, currentBranch)
    setIsPushing(false)
    setPushPercent(null)
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
    <div className="changes-panel">
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
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => unstageFiles(staged.map((f) => f.path))}
                >
                  {t('changes_unstage_all')}
                </button>
              </div>
            </div>
            {staged.map((f) => <FileRow key={f.path} file={f} />)}
          </div>
        )}

        {unstaged.length > 0 && (
          <div className="changes-group">
            <div className="changes-group-header">
              <span className="changes-group-label">{t('changes_unstaged')}</span>
              <span className="changes-group-count">{unstaged.length}</span>
              <div className="changes-group-actions">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => stageFiles(unstaged.map((f) => f.path))}
                >
                  {t('changes_stage_all')}
                </button>
              </div>
            </div>
            {unstaged.map((f) => <FileRow key={f.path} file={f} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function FileRow({ file }: { file: ChangedFile }) {
  const { selectedFiles, toggleFileSelection, stageFiles, unstageFiles, currentRepo, refreshStatus } = useRepoStore()
  const isSelected = selectedFiles.has(file.path)
  const [confirmRevert, setConfirmRevert] = useState(false)

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
      className={`file-row ${isSelected ? 'selected' : ''} ${file.status === 'conflicted' ? 'conflicted' : ''}`}
      onClick={() => toggleFileSelection(file.path)}
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
