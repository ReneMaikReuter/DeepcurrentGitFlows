import { useState } from 'react'
import { Globe, GitBranch, Upload, ExternalLink, Trash2 } from 'lucide-react'
import { Modal } from './Modal'
import { ipc, IPC } from '../../hooks/useIpc'
import { useRepoStore } from '../../store/repoStore'
import './RemoteSetupModal.css'

interface Props {
  onClose: () => void
}

type Tab = 'existing' | 'new'
type Step = 'setup' | 'push' | 'done'

export function RemoteSetupModal({ onClose }: Props) {
  const { currentRepo, currentBranch, refreshBranches, refreshStatus } = useRepoStore()
  const hasRemote = !!currentRepo?.remote

  const [tab, setTab] = useState<Tab>('existing')
  const [existingUrl, setExistingUrl] = useState('')
  const [token, setToken] = useState('')
  const [repoName, setRepoName] = useState(currentRepo?.name ?? '')
  const [isPrivate, setIsPrivate] = useState(false)
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('setup')
  const [confirmRemove, setConfirmRemove] = useState(false)

  const handleConnectExisting = async () => {
    if (!currentRepo || !existingUrl.trim()) return
    setLoading(true); setError(null)
    const res = await ipc.invoke<{ success: boolean; error?: string }>(IPC.REMOTE_ADD, currentRepo.path, existingUrl.trim())
    setLoading(false)
    if (!res.success) { setError(res.error ?? 'Failed to set remote.'); return }
    setStep('push')
  }

  const handleCreateNew = async () => {
    if (!currentRepo || !token.trim() || !repoName.trim()) return
    setLoading(true); setError(null)
    const res = await ipc.invoke<{ success: boolean; error?: string; repoUrl?: string }>(
      IPC.REMOTE_CREATE_GITHUB, currentRepo.path, token.trim(), repoName.trim(), isPrivate,
    )
    setLoading(false)
    if (!res.success) { setError(res.error ?? 'Failed to create repository.'); return }
    setCreatedUrl(res.repoUrl ?? null)
    setStep('push')
  }

  const handlePush = async () => {
    if (!currentRepo || !currentBranch) return
    setLoading(true); setError(null)
    const res = await ipc.invoke<{ success: boolean; error?: string }>(IPC.REMOTE_PUSH_INITIAL, currentRepo.path, currentBranch)
    setLoading(false)
    if (!res.success) { setError(res.error ?? 'Push failed. Check your credentials.'); return }
    await refreshBranches()
    await refreshStatus()
    setStep('done')
  }

  const handleRemove = async () => {
    if (!currentRepo) return
    setLoading(true); setError(null)
    await ipc.invoke(IPC.REMOTE_REMOVE, currentRepo.path)
    setLoading(false)
    // Reload repo so remote is cleared in store
    await ipc.invoke(IPC.REPO_OPEN, currentRepo.path)
    onClose()
  }

  // ── Manage mode (already has remote) ──────────────────────────────────────
  if (hasRemote && step === 'setup') {
    return (
      <Modal
        title="GitHub Remote"
        onClose={onClose}
        width={420}
        footer={
          confirmRemove ? (
            <>
              <button className="btn btn-ghost" onClick={() => setConfirmRemove(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleRemove} disabled={loading}>
                {loading ? 'Removing…' : 'Yes, Remove Remote'}
              </button>
            </>
          ) : (
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          )
        }
      >
        <div className="rsetup-body">
          <div className="rsetup-manage-url">
            <Globe size={14} style={{ flexShrink: 0, color: 'var(--accent)' }} />
            <span className="truncate">{currentRepo?.remote}</span>
          </div>
          <p className="rsetup-hint" style={{ marginTop: 'var(--sp-4)' }}>
            To connect a different repository, remove this remote first and then reconnect.
          </p>
          {!confirmRemove ? (
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)', alignSelf: 'flex-start' }} onClick={() => setConfirmRemove(true)}>
              <Trash2 size={12} /> Remove Remote
            </button>
          ) : (
            <div className="rsetup-error">
              This removes the GitHub connection from your local repository. Your local commits and files stay intact.
            </div>
          )}
          {error && <div className="rsetup-error">{error}</div>}
        </div>
      </Modal>
    )
  }

  // ── Setup / Push / Done flow ───────────────────────────────────────────────
  const footer = step === 'setup' ? (
    <>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button
        className="btn btn-primary"
        onClick={tab === 'existing' ? handleConnectExisting : handleCreateNew}
        disabled={loading || (tab === 'existing' ? !existingUrl.trim() : !token.trim() || !repoName.trim())}
      >
        {loading ? 'Working…' : tab === 'existing' ? 'Connect' : 'Create Repository'}
      </button>
    </>
  ) : step === 'push' ? (
    <>
      <button className="btn btn-ghost" onClick={onClose}>Skip (push later)</button>
      <button className="btn btn-primary" onClick={handlePush} disabled={loading}>
        <Upload size={13} />
        {loading ? 'Pushing…' : `Push "${currentBranch}" to GitHub`}
      </button>
    </>
  ) : (
    <button className="btn btn-primary" onClick={onClose}>Done</button>
  )

  return (
    <Modal title="Connect to GitHub" onClose={onClose} width={460} footer={footer}>
      {step === 'setup' && (
        <>
          <div className="rsetup-tabs">
            <button className={`rsetup-tab ${tab === 'existing' ? 'active' : ''}`} onClick={() => setTab('existing')}>
              <Globe size={13} /> Existing Repository
            </button>
            <button className={`rsetup-tab ${tab === 'new' ? 'active' : ''}`} onClick={() => setTab('new')}>
              <GitBranch size={13} /> Create New on GitHub
            </button>
          </div>

          {tab === 'existing' ? (
            <div className="rsetup-body">
              <p className="rsetup-hint">Paste the URL of an existing GitHub repository.</p>
              <label className="rsetup-label">Repository URL</label>
              <input
                className="rsetup-input" type="text"
                placeholder="https://github.com/username/repo.git"
                value={existingUrl} onChange={(e) => setExistingUrl(e.target.value)} autoFocus
              />
            </div>
          ) : (
            <div className="rsetup-body">
              <p className="rsetup-hint">
                Requires a Personal Access Token (classic) with <strong>repo</strong> scope.{' '}
                <a className="rsetup-link" href="https://github.com/settings/tokens/new?scopes=repo&description=Deepcurrent+Git" target="_blank" rel="noreferrer">
                  Create token <ExternalLink size={10} />
                </a>
              </p>
              <label className="rsetup-label">GitHub Token</label>
              <input className="rsetup-input" type="password" placeholder="ghp_xxxxxxxxxxxx"
                value={token} onChange={(e) => setToken(e.target.value)} autoFocus />
              <label className="rsetup-label" style={{ marginTop: 'var(--sp-3)' }}>Repository Name</label>
              <input className="rsetup-input" type="text" placeholder="my-unreal-project"
                value={repoName} onChange={(e) => setRepoName(e.target.value)} />
              <label className="rsetup-checkbox-row">
                <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
                <span>Private repository</span>
              </label>
            </div>
          )}
        </>
      )}

      {step === 'push' && (
        <div className="rsetup-body">
          <div className="rsetup-success-icon">✓</div>
          <p className="rsetup-success-text">
            {createdUrl
              ? <><a className="rsetup-link" href={createdUrl} target="_blank" rel="noreferrer">{createdUrl} <ExternalLink size={10} /></a> created.</>
              : 'Remote connected.'}
          </p>
          <p className="rsetup-hint" style={{ marginTop: 'var(--sp-4)' }}>
            Push branch <strong>"{currentBranch}"</strong> so others can access it.
          </p>
        </div>
      )}

      {step === 'done' && (
        <div className="rsetup-body">
          <div className="rsetup-success-icon" style={{ color: 'var(--success)' }}>✓</div>
          <p className="rsetup-success-text">All done! Your project is on GitHub.</p>
          {createdUrl && (
            <a className="rsetup-link" href={createdUrl} target="_blank" rel="noreferrer" style={{ textAlign: 'center' }}>
              {createdUrl} <ExternalLink size={10} />
            </a>
          )}
        </div>
      )}

      {error && <div className="rsetup-error">{error}</div>}
    </Modal>
  )
}
