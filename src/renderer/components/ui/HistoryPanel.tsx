import { useEffect, useState, useRef } from 'react'
import { RotateCcw, ChevronDown, ChevronRight, FileX, FilePlus, FileEdit, Cloud, HardDrive, Search, X } from 'lucide-react'
import { ipc, IPC } from '../../hooks/useIpc'
import { useRepoStore } from '../../store/repoStore'
import { useT, t as tFn } from '../../i18n/useT'
import type { HistoryCommit, HistoryFile } from '../../../shared/types'
import './HistoryPanel.css'

function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return 'just now'
}

function FileStatusIcon({ status }: { status: HistoryFile['status'] }) {
  if (status === 'D') return <FileX size={11} style={{ color: 'var(--error)', flexShrink: 0 }} />
  if (status === 'A') return <FilePlus size={11} style={{ color: 'var(--success)', flexShrink: 0 }} />
  return <FileEdit size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
}

function basename(p: string) {
  return p.split(/[/\\]/).pop() ?? p
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="history-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function commitMatchesQuery(commit: HistoryCommit, q: string): boolean {
  if (!q) return true
  const lower = q.toLowerCase()
  if (commit.message.toLowerCase().includes(lower)) return true
  if (commit.author.toLowerCase().includes(lower)) return true
  if (commit.shortHash.toLowerCase().includes(lower)) return true
  if ((commit.branches ?? []).some((b) => b.toLowerCase().includes(lower))) return true
  if (commit.files.some((f) => f.path.toLowerCase().includes(lower))) return true
  // Date search: "2026" or "Sep"
  const dateStr = new Date(commit.date).toLocaleDateString('de-DE', { year: 'numeric', month: 'short', day: 'numeric' })
  if (dateStr.toLowerCase().includes(lower)) return true
  return false
}

interface CommitRowProps {
  commit: HistoryCommit
  isHead: boolean
  query: string
  onRestoreFiles: (hash: string, files: string[], statuses: Record<string, string>) => Promise<void>
  onUndoCommit: (hash: string) => Promise<void>
  onRevertCommit: (hash: string) => Promise<void>
  scrollRef?: (el: HTMLDivElement | null) => void
}

function CommitRow({ commit, isHead, query, onRestoreFiles, onUndoCommit, onRevertCommit, scrollRef }: CommitRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [working, setWorking] = useState(false)
  const [confirmRevert, setConfirmRevert] = useState(false)

  const shouldExpand = expanded

  const toggleFile = (path: string) => {
    const next = new Set(selected)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    setSelected(next)
  }

  const handleRestore = async () => {
    if (selected.size === 0) return
    setWorking(true)
    const statuses: Record<string, string> = {}
    commit.files.forEach((f) => { statuses[f.path] = f.status })
    await onRestoreFiles(commit.hash, [...selected], statuses)
    setSelected(new Set())
    setWorking(false)
  }

  const handleUndo = async () => {
    setWorking(true)
    await onUndoCommit(commit.hash)
    setWorking(false)
  }

  const handleRevert = async () => {
    setWorking(true)
    setConfirmRevert(false)
    await onRevertCommit(commit.hash)
    setWorking(false)
  }

  return (
    <div
      className={`history-commit ${isHead ? 'history-commit--head' : ''} ${query && commitMatchesQuery(commit, query) ? 'history-commit--match' : ''}`}
      ref={scrollRef}
    >
      <div className="history-commit-header" onClick={() => setExpanded(!expanded)}>
        <span className="history-expand-icon">
          {shouldExpand ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <span className="history-avatar">{commit.author[0]?.toUpperCase() ?? '?'}</span>
        <div className="history-commit-meta">
          <span className="history-commit-msg truncate">
            <Highlight text={commit.message} query={query} />
          </span>
          <span className="history-commit-sub">
            <span className="history-author"><Highlight text={commit.author} query={query} /></span>
            <span className="history-dot">·</span>
            <span className="history-hash">{commit.shortHash}</span>
            <span className="history-dot">·</span>
            <span className="history-time">{timeAgo(commit.date)}</span>
          </span>
        </div>
        <div className="history-badges">
          {commit.pushedToRemote
            ? <span className="history-badge history-badge--remote"><Cloud size={10} /> {tFn('history_remote')}</span>
            : <span className="history-badge history-badge--local"><HardDrive size={10} /> {tFn('history_local')}</span>
          }
          {isHead && <span className="history-badge history-badge--head">HEAD</span>}
          {(commit.branches ?? []).filter(b => !b.startsWith('origin/')).map((b) => (
            <span key={b} className={`history-badge history-badge--branch ${query && b.toLowerCase().includes(query.toLowerCase()) ? 'history-badge--match' : ''}`} title={b}>
              <Highlight text={b} query={query} />
            </span>
          ))}
        </div>
      </div>

      {shouldExpand && (
        <div className="history-expand-body">
        <div className="history-files">
          {commit.files.length === 0 && (
            <div className="history-no-files">{tFn('history_no_files')}</div>
          )}
          {commit.files.map((f) => {
            const nameMatch = query && f.path.toLowerCase().includes(query.toLowerCase())
            return (
              <label key={f.path} className={`history-file history-file--selectable ${nameMatch ? 'history-file--match' : ''}`}>
                <input
                  type="checkbox"
                  className="history-file-check"
                  checked={selected.has(f.path)}
                  onChange={() => toggleFile(f.path)}
                />
                <FileStatusIcon status={f.status} />
                <span className="history-file-name truncate" title={f.path}>
                  <Highlight text={basename(f.path)} query={query} />
                </span>
                <span className="history-file-path truncate">
                  <Highlight text={f.path} query={query} />
                </span>
              </label>
            )
          })}

        </div>
        <div className="history-actions">
            {commit.files.length > 0 && (
              <>
                <button
                  className="btn btn-ghost btn-sm"
                  title="Alle Dateien dieses Commits auswählen"
                  onClick={() => setSelected(new Set(commit.files.map((f) => f.path)))}
                >
                  Alle ({commit.files.length})
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={selected.size === 0 || working}
                  onClick={handleRestore}
                  title="Ausgewählte Dateien auf den Stand vor diesem Commit zurücksetzen"
                >
                  <RotateCcw size={11} />
                  Wiederherstellen ({selected.size})
                </button>
              </>
            )}
            <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', alignItems: 'center' }}>
              {isHead && !commit.pushedToRemote && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--warning)' }}
                  disabled={working}
                  onClick={handleUndo}
                  title="Macht diesen Commit vollständig rückgängig. Die Änderungen landen als unstaged in deinem Arbeitsverzeichnis. Nur für noch nicht gepushte Commits möglich."
                >
                  <RotateCcw size={11} />
                  {tFn('history_undo')}
                </button>
              )}
              {confirmRevert ? (
                <>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{tFn('history_revert_confirm')}</span>
                  <button className="btn btn-danger btn-sm" style={{ height: 18, fontSize: 10 }} disabled={working} onClick={handleRevert}>Ja</button>
                  <button className="btn btn-ghost btn-sm" style={{ height: 18, fontSize: 10 }} onClick={() => setConfirmRevert(false)}>Nein</button>
                </>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--text-secondary)' }}
                  disabled={working}
                  onClick={() => setConfirmRevert(true)}
                  title="Erstellt einen neuen Commit der alle Änderungen dieses Commits umkehrt. Der ursprüngliche Commit bleibt in der History sichtbar. Sicher auch für bereits gepushte Commits."
                >
                  <RotateCcw size={11} />
                  {tFn('history_revert')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function HistoryPanel() {
  const t = useT()
  const { currentRepo, currentBranch, refreshStatus, refreshBranches } = useRepoStore()
  const [commits, setCommits] = useState<HistoryCommit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [undoAllConfirm, setUndoAllConfirm] = useState(false)
  const firstMatchRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    if (!currentRepo) return
    setLoading(true)
    setError(null)
    try {
      const result = await ipc.invoke<HistoryCommit[]>(IPC.HISTORY_GET, currentRepo.path, 60)
      setCommits(result ?? [])
    } catch {
      setError('Failed to load history.')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [currentRepo?.path, currentBranch])

  // Scroll to first match when query changes
  useEffect(() => {
    if (query && firstMatchRef.current) {
      firstMatchRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [query])

  const filteredCommits = query
    ? commits.filter((c) => commitMatchesQuery(c, query))
    : commits

  const handleRestoreFiles = async (hash: string, files: string[], statuses: Record<string, string> = {}) => {
    if (!currentRepo) return
    setRestoreError(null)
    const res = await ipc.invoke<{ success: boolean; results: { path: string; success: boolean; error?: string }[] }>(
      IPC.HISTORY_RESTORE_FILES, currentRepo.path, hash, files, statuses,
    )
    if (!res.success) {
      const failed = res.results.filter((r) => !r.success).map((r) => r.path).join(', ')
      setRestoreError(`Could not restore: ${failed}`)
    }
    await refreshStatus()
    await load()
  }

  const handleUndoCommit = async (hash: string) => {
    if (!currentRepo) return
    setRestoreError(null)
    const res = await ipc.invoke<{ success: boolean; error?: string }>(IPC.HISTORY_UNDO_COMMIT, currentRepo.path, hash)
    if (!res.success) { setRestoreError(res.error ?? 'Undo fehlgeschlagen.'); return }
    await refreshStatus()
    await refreshBranches()
    await load()
  }

  const handleRevertCommit = async (hash: string) => {
    if (!currentRepo) return
    setRestoreError(null)
    const res = await ipc.invoke<{ success: boolean; error?: string }>(IPC.HISTORY_REVERT_COMMIT, currentRepo.path, hash)
    if (!res.success) { setRestoreError(res.error ?? 'Revert fehlgeschlagen.'); return }
    await refreshStatus()
    await refreshBranches()
    await load()
  }

  const handleUndoAllUnpushed = async () => {
    if (!currentRepo || !currentBranch) return
    setRestoreError(null)
    setUndoAllConfirm(false)
    const res = await ipc.invoke<{ success: boolean; error?: string }>(
      IPC.HISTORY_UNDO_ALL_UNPUSHED, currentRepo.path, currentBranch
    )
    if (!res.success) { setRestoreError(res.error ?? 'Undo fehlgeschlagen.'); return }
    await refreshStatus()
    await refreshBranches()
    await load()
  }

  if (!currentRepo) return null

  const unpushedCommits = commits.filter((c) => !c.pushedToRemote)
  const hasMultipleUnpushed = unpushedCommits.length >= 2

  let firstMatchSet = false

  return (
    <div className="history-panel">
      <div className="history-toolbar">
        <span className="panel-label">HISTORY</span>
        {hasMultipleUnpushed && !query && (
          undoAllConfirm ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{unpushedCommits.length} zurück?</span>
              <button className="btn btn-danger btn-sm" style={{ height: 18, fontSize: 10 }} onClick={handleUndoAllUnpushed}>Ja</button>
              <button className="btn btn-ghost btn-sm" style={{ height: 18, fontSize: 10 }} onClick={() => setUndoAllConfirm(false)}>Nein</button>
            </div>
          ) : (
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--warning)', fontSize: 10 }}
              title={`Alle ${unpushedCommits.length} nicht-gepushten Commits rueckgaengig machen`}
              onClick={() => setUndoAllConfirm(true)}
            >
              <RotateCcw size={10} strokeWidth={2} />
              {t('history_undo_all')}
            </button>
          )
        )}
        <button className="btn-icon" onClick={load} title="Refresh" disabled={loading}>
          <RotateCcw size={12} strokeWidth={2} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* Search bar */}
      <div className="history-search">
        <Search size={12} strokeWidth={2} className="history-search-icon" />
        <input
          ref={searchRef}
          className="history-search-input"
          placeholder={t('history_search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button className="btn-icon history-search-clear" onClick={() => setQuery('')}>
            <X size={11} />
          </button>
        )}
      </div>

      {query && (
        <div className="history-search-info">
          {filteredCommits.length === 0
            ? t('history_no_commits')
            : `${filteredCommits.length} Commits ${t('history_commits_found')}`}
        </div>
      )}

      {restoreError && <div className="history-error">{restoreError}</div>}
      {loading && commits.length === 0 && <div className="history-empty">Loading…</div>}
      {!loading && commits.length === 0 && <div className="history-empty">No commits yet.</div>}
      {error && <div className="history-error">{error}</div>}

      <div className="history-list">
        {filteredCommits.map((c, i) => {
          const isFirstMatch = query && !firstMatchSet
          if (isFirstMatch) firstMatchSet = true
          return (
            <CommitRow
              key={c.hash}
              commit={c}
              isHead={!query && i === 0}
              query={query}
              onRestoreFiles={handleRestoreFiles}
              onUndoCommit={handleUndoCommit}
              onRevertCommit={handleRevertCommit}
              scrollRef={isFirstMatch ? (el) => { firstMatchRef.current = el } : undefined}
            />
          )
        })}
      </div>
    </div>
  )
}
