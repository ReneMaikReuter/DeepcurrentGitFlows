import { useState, useEffect } from 'react'
import { Trash2, Plus, RotateCcw } from 'lucide-react'
import { Modal } from './Modal'
import { ipc, IPC } from '../../hooks/useIpc'
import { useRepoStore } from '../../store/repoStore'
import type { Backup } from '../../../shared/types'
import './BackupRestoreModal.css'

interface Props {
  onClose: () => void
}

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

export function BackupRestoreModal({ onClose }: Props) {
  const { currentRepo, branches } = useRepoStore()
  const [backups, setBackups] = useState<Backup[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Create backup state
  const [showCreate, setShowCreate] = useState(false)
  const [createLabel, setCreateLabel] = useState('')
  const [creating, setCreating] = useState(false)

  // Delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const load = async () => {
    if (!currentRepo) return
    setLoading(true)
    const list = await ipc.invoke<Backup[]>(IPC.BACKUP_LIST, currentRepo.path)
    setBackups(list ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [currentRepo?.path])

  const handleCreate = async () => {
    if (!currentRepo) return
    setCreating(true)
    setMsg(null)
    const label = createLabel.trim() || 'manual'
    const res = await ipc.invoke<{ success: boolean; backup: Backup }>(IPC.BACKUP_CREATE, currentRepo.path, label)
    setCreating(false)
    if (res.success) {
      setMsg({ ok: true, text: `Backup "${label}" created. ${res.backup.fileCount} files.` })
      setShowCreate(false)
      setCreateLabel('')
      await load()
    } else {
      setMsg({ ok: false, text: 'Backup failed.' })
    }
  }

  const handleRestore = async (backup: Backup) => {
    if (!currentRepo) return
    setWorking(backup.id)
    setMsg(null)
    const res = await ipc.invoke<{ success: boolean; restoredCount: number; error: string | null }>(
      IPC.BACKUP_RESTORE, currentRepo.path, backup.id,
    )
    setWorking(null)
    setMsg({
      ok: res.success,
      text: res.success
        ? `Restored ${res.restoredCount} file${res.restoredCount !== 1 ? 's' : ''}.`
        : res.error ?? 'Restore failed.',
    })
  }

  const handleDelete = async (backupId: string) => {
    if (confirmDelete !== backupId) {
      setConfirmDelete(backupId)
      return
    }
    if (!currentRepo) return
    await ipc.invoke(IPC.BACKUP_DELETE, currentRepo.path, backupId)
    setBackups((prev) => prev.filter((b) => b.id !== backupId))
    setConfirmDelete(null)
  }

  const localBranches = branches.filter((b) => !b.isRemote)

  return (
    <Modal
      title="Backups"
      onClose={onClose}
      width={520}
      footer={
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
          <Plus size={13} /> New Backup
        </button>
      }
    >
      {/* Create backup form */}
      {showCreate && (
        <div className="backup-create-form">
          <div className="backup-create-title">Create Backup</div>
          <p className="backup-create-hint">
            Saves a snapshot of the entire working directory to <code>.deepcurrent/backups/</code>.
            {localBranches.length > 0 && (
              <> Currently on branch <strong>{localBranches.find(b => b.isCurrent)?.name ?? '—'}</strong>.</>
            )}
          </p>
          <label className="backup-create-label">Label (optional)</label>
          <input
            className="backup-create-input"
            type="text"
            placeholder="e.g. before-big-refactor"
            value={createLabel}
            onChange={(e) => setCreateLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
            autoFocus
          />
          <div className="backup-create-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {msg && (
        <div className={`backup-msg ${msg.ok ? 'backup-msg--ok' : 'backup-msg--err'}`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="backup-empty">Loading…</div>
      ) : backups.length === 0 ? (
        <div className="backup-empty">No backups yet. Click "New Backup" to create one.</div>
      ) : (
        <div className="backup-list">
          {backups.map((backup) => {
            const isConfirming = confirmDelete === backup.id
            return (
              <div key={backup.id} className={`backup-item ${isConfirming ? 'backup-item--confirm' : ''}`}>
                <div className="backup-info">
                  <div className="backup-name">{backup.triggeredBy}</div>
                  <div className="backup-meta">
                    {backup.fileCount} files · {timeAgo(backup.createdAt)} · {new Date(backup.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="backup-actions">
                  {isConfirming ? (
                    <>
                      <span className="backup-confirm-text">Delete?</span>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(backup.id)}>
                        Yes, delete
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleRestore(backup)}
                        disabled={!!working}
                        title="Restore this backup"
                      >
                        <RotateCcw size={11} />
                        {working === backup.id ? 'Restoring…' : 'Restore'}
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => handleDelete(backup.id)}
                        disabled={!!working}
                        title="Delete backup (will ask for confirmation)"
                      >
                        <Trash2 size={12} strokeWidth={2} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
