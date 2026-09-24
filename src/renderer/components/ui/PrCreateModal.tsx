import { useEffect, useState } from 'react'
import { GitPullRequest, X, ExternalLink } from 'lucide-react'
import { ipc, IPC } from '../../hooks/useIpc'
import { toast } from '../../store/toastStore'
import { Modal } from './Modal'
import type { Branch } from '../../../shared/types'
import './PrCreateModal.css'

interface Props {
  repoPath: string
  currentBranch: string
  branches: Branch[]
  onClose: () => void
}

export function PrCreateModal({ repoPath, currentBranch, branches, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [base, setBase] = useState('dev_branch')
  const [submitting, setSubmitting] = useState(false)
  const [isGitHub, setIsGitHub] = useState<boolean | null>(null)

  useEffect(() => {
    ipc.invoke<string | null>(IPC.REMOTE_URL_GET, repoPath).then((url) => {
      setIsGitHub(!!url?.includes('github.com'))
    })
    // Try to find a sensible default base branch
    const candidates = ['dev_branch', 'Dev_Branch', 'develop', 'development', 'main', 'master']
    const found = candidates.find((c) => branches.some((b) => b.name.toLowerCase() === c.toLowerCase()))
    if (found) setBase(found)
  }, [repoPath])

  const localBranches = branches.filter((b) => !b.isRemote)

  const handleSubmit = async () => {
    if (!title.trim()) { toast.err('Bitte einen Titel eingeben.'); return }
    setSubmitting(true)
    const res = await ipc.invoke<{ success: boolean; error?: string; url?: string }>(
      IPC.PR_CREATE, repoPath, title.trim(), body.trim(), currentBranch, base,
    )
    setSubmitting(false)
    if (!res?.success) { toast.err(res?.error ?? 'PR-Erstellung fehlgeschlagen.'); return }
    toast.ok('Pull Request erstellt.')
    if (res.url) {
      ipc.invoke('shell:open-external' as any, res.url)
    }
    onClose()
  }

  return (
    <Modal title="Pull Request erstellen" onClose={onClose} width={500}>
      <div className="pr-modal">
        <div className="pr-modal-header">
          <GitPullRequest size={16} strokeWidth={1.8} />
          <span className="pr-modal-title">Pull Request erstellen</span>
          <button className="btn-icon" style={{ marginLeft: 'auto' }} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {isGitHub === false && (
          <div className="pr-modal-warning">
            Kein GitHub-Repository erkannt. PR-Erstellung benötigt GitHub als Remote.
          </div>
        )}

        <div className="pr-modal-body">
          <div className="pr-field">
            <label className="pr-label">Von Branch</label>
            <div className="pr-branch-display">{currentBranch}</div>
          </div>

          <div className="pr-field">
            <label className="pr-label">In Branch (Base)</label>
            <select
              className="pr-select"
              value={base}
              onChange={(e) => setBase(e.target.value)}
            >
              {localBranches.filter((b) => b.name !== currentBranch).map((b) => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="pr-field">
            <label className="pr-label">Titel *</label>
            <input
              className="pr-input"
              placeholder="Was wird mit diesem PR geändert?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
              autoFocus
            />
          </div>

          <div className="pr-field">
            <label className="pr-label">Beschreibung</label>
            <textarea
              className="pr-textarea"
              placeholder="Optionale Beschreibung der Änderungen…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <div className="pr-modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Abbrechen</button>
          <button
            className="btn btn-primary"
            disabled={submitting || !title.trim() || isGitHub === false}
            onClick={handleSubmit}
          >
            <ExternalLink size={13} />
            {submitting ? 'Erstelle…' : 'PR auf GitHub erstellen'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
