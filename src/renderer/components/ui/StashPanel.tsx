import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2, Download, GitCommit } from 'lucide-react'
import { ipc, IPC } from '../../hooks/useIpc'
import { toast } from '../../store/toastStore'
import type { StashEntry } from '../../../shared/types'
import './StashPanel.css'

interface Props {
  repoPath: string
  onStashChange?: () => void
}

export function StashPanel({ repoPath, onStashChange }: Props) {
  const [stashes, setStashes] = useState<StashEntry[]>([])
  const [expanded, setExpanded] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [creating, setCreating] = useState(false)
  const [working, setWorking] = useState(false)

  const load = async () => {
    const result = await ipc.invoke<StashEntry[]>(IPC.STASH_LIST, repoPath)
    setStashes(result ?? [])
  }

  useEffect(() => { load() }, [repoPath])

  const handleCreate = async () => {
    setCreating(false)
    setWorking(true)
    const res = await ipc.invoke<{ success: boolean; error: string | null }>(IPC.STASH_PUSH, repoPath, nameInput.trim() || undefined)
    setWorking(false)
    setNameInput('')
    if (!res?.success) { toast.err(res?.error ?? 'Stash fehlgeschlagen.'); return }
    toast.ok('Stash erstellt.')
    await load()
    onStashChange?.()
  }

  const handlePop = async (index: number) => {
    setWorking(true)
    const res = await ipc.invoke<{ success: boolean; error: string | null }>(IPC.STASH_POP, repoPath, index)
    setWorking(false)
    if (!res?.success) { toast.err(res?.error ?? 'Stash anwenden fehlgeschlagen.'); return }
    toast.ok('Stash angewendet und entfernt.')
    await load()
    onStashChange?.()
  }

  const handleApply = async (index: number) => {
    setWorking(true)
    const res = await ipc.invoke<{ success: boolean; error: string | null }>(IPC.STASH_APPLY, repoPath, index)
    setWorking(false)
    if (!res?.success) { toast.err(res?.error ?? 'Stash anwenden fehlgeschlagen.'); return }
    toast.ok('Stash angewendet (noch in der Liste).')
    onStashChange?.()
  }

  const handleDrop = async (index: number) => {
    setWorking(true)
    const res = await ipc.invoke<{ success: boolean; error: string | null }>(IPC.STASH_DROP, repoPath, index)
    setWorking(false)
    if (!res?.success) { toast.err(res?.error ?? 'Stash löschen fehlgeschlagen.'); return }
    await load()
  }

  return (
    <div className="stash-panel">
      <div className="stash-header" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="stash-label">STASH</span>
        {stashes.length > 0 && <span className="stash-count">{stashes.length}</span>}
        <div style={{ flex: 1 }} />
        <button
          className="btn-icon"
          title="Aktuelle Änderungen stashen"
          disabled={working}
          onClick={(e) => { e.stopPropagation(); setExpanded(true); setCreating(true) }}
        >
          <Plus size={12} />
        </button>
      </div>

      {expanded && (
        <div className="stash-body">
          {creating && (
            <div className="stash-create">
              <input
                className="stash-name-input"
                placeholder="Beschreibung (optional)"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCreating(false); setNameInput('') } }}
                autoFocus
              />
              <button className="btn btn-primary btn-sm" disabled={working} onClick={handleCreate}>Stash</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setCreating(false); setNameInput('') }}>✕</button>
            </div>
          )}

          {stashes.length === 0 && !creating && (
            <div className="stash-empty">Kein Stash vorhanden</div>
          )}

          {stashes.map((s) => (
            <div key={s.index} className="stash-entry">
              <GitCommit size={11} className="stash-entry-icon" />
              <div className="stash-entry-info">
                <span className="stash-entry-message truncate" title={s.message}>{s.message || `stash@{${s.index}}`}</span>
                <span className="stash-entry-date">{s.date}</span>
              </div>
              <div className="stash-entry-actions">
                <button
                  className="btn-icon btn-sm"
                  title="Anwenden und behalten"
                  disabled={working}
                  onClick={() => handleApply(s.index)}
                >
                  <Download size={11} />
                </button>
                <button
                  className="btn-icon btn-sm"
                  title="Anwenden und löschen (Pop)"
                  disabled={working}
                  onClick={() => handlePop(s.index)}
                >
                  <Download size={11} style={{ color: 'var(--accent)' }} />
                </button>
                <button
                  className="btn-icon btn-sm"
                  title="Stash löschen"
                  disabled={working}
                  onClick={() => handleDrop(s.index)}
                >
                  <Trash2 size={11} style={{ color: 'var(--error)' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
