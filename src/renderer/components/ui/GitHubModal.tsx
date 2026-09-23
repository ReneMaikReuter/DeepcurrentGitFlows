import { useState, useEffect, useRef } from 'react'
import { GitBranch, Loader, LogOut, Search, Lock, Unlock, ExternalLink } from 'lucide-react'
import { Modal } from './Modal'
import { ipc, IPC } from '../../hooks/useIpc'

import type { GitHubUser, GitHubRepo } from '../../../shared/types'
import './GitHubModal.css'

interface Props {
  onClose: () => void
  onClone: (cloneUrl: string, repoName: string) => void
}

type Step = 'check' | 'login' | 'polling' | 'repos'

export function GitHubModal({ onClose, onClone }: Props) {
  const [step, setStep] = useState<Step>('check')
  const [user, setUser] = useState<GitHubUser | null>(null)
  const [userCode, setUserCode] = useState('')
  const [verificationUri, setVerificationUri] = useState('')
  const [_deviceCode, setDeviceCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [query, setQuery] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // On mount: check if already logged in
  useEffect(() => {
    ipc.invoke<GitHubUser | null>(IPC.GITHUB_GET_USER).then((u) => {
      if (u) {
        setUser(u)
        setStep('repos')
        loadRepos()
      } else {
        setStep('login')
      }
    })
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const loadRepos = async () => {
    setLoadingRepos(true)
    const res = await ipc.invoke<{ success: boolean; error?: string; repos: GitHubRepo[] }>(IPC.GITHUB_LIST_REPOS)
    setLoadingRepos(false)
    if (res.success) setRepos(res.repos)
    else setError(res.error ?? 'Fehler beim Laden der Repos.')
  }

  const startDeviceFlow = async () => {
    setError(null)
    const res = await ipc.invoke<any>(IPC.GITHUB_DEVICE_START)
    if (!res.success) { setError(res.error); return }

    setUserCode(res.user_code)
    setVerificationUri(res.verification_uri)
    setDeviceCode(res.device_code)
    setStep('polling')

    // Open verification page in browser
    window.open(res.verification_uri, '_blank')

    // Start polling
    pollRef.current = setInterval(async () => {
      const poll = await ipc.invoke<{ status: string; token?: string; error?: string }>(
        IPC.GITHUB_DEVICE_POLL, res.device_code
      )
      if (poll.status === 'authorized') {
        clearInterval(pollRef.current!)
        pollRef.current = null
        const u = await ipc.invoke<GitHubUser | null>(IPC.GITHUB_GET_USER)
        setUser(u)
        setStep('repos')
        loadRepos()
      } else if (poll.status === 'expired' || poll.status === 'denied') {
        clearInterval(pollRef.current!)
        pollRef.current = null
        setError(poll.status === 'denied' ? 'Zugriff verweigert.' : 'Code abgelaufen. Bitte erneut versuchen.')
        setStep('login')
      }
    }, res.interval * 1000)
  }

  const handleLogout = async () => {
    await ipc.invoke(IPC.GITHUB_CLEAR_TOKEN)
    if (pollRef.current) clearInterval(pollRef.current)
    setUser(null)
    setRepos([])
    setStep('login')
  }

  const filteredRepos = query
    ? repos.filter((r) => r.full_name.toLowerCase().includes(query.toLowerCase()) || (r.description ?? '').toLowerCase().includes(query.toLowerCase()))
    : repos

  return (
    <Modal title="Von GitHub öffnen" onClose={onClose} width={520}>
      {step === 'check' && (
        <div className="gh-loading"><Loader size={20} className="spin" /></div>
      )}

      {step === 'login' && (
        <div className="gh-login">
          <div className="gh-login-icon"><GitBranch size={32} /></div>
          <div className="gh-login-title">Mit GitHub anmelden</div>
          <div className="gh-login-desc">
            Einmalige Anmeldung. Danach siehst du alle deine Repos direkt im Programm.
          </div>
          {error && <div className="gh-error">{error}</div>}
          <button className="btn btn-primary gh-login-btn" onClick={startDeviceFlow}>
            <GitBranch size={14} />
            Anmelden mit GitHub
          </button>
        </div>
      )}

      {step === 'polling' && (
        <div className="gh-polling">
          <div className="gh-polling-title">Browser öffnet sich…</div>
          <div className="gh-polling-desc">
            Gib diesen Code auf <strong>{verificationUri}</strong> ein:
          </div>
          <div className="gh-user-code">{userCode}</div>
          <div className="gh-polling-hint">
            <Loader size={12} className="spin" />
            Warte auf Bestätigung…
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}
            onClick={() => window.open(verificationUri, '_blank')}>
            <ExternalLink size={11} /> Seite erneut öffnen
          </button>
          {error && <div className="gh-error">{error}</div>}
        </div>
      )}

      {step === 'repos' && (
        <div className="gh-repos">
          <div className="gh-repos-header">
            <div className="gh-user-info">
              <GitBranch size={14} />
              <span className="gh-username">{user?.login ?? '…'}</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout} title="Abmelden">
              <LogOut size={11} /> Abmelden
            </button>
          </div>

          <div className="gh-search">
            <Search size={12} className="gh-search-icon" />
            <input
              className="gh-search-input"
              placeholder="Repo suchen…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>

          {loadingRepos && (
            <div className="gh-loading"><Loader size={16} className="spin" /></div>
          )}
          {error && <div className="gh-error">{error}</div>}

          <div className="gh-repo-list">
            {filteredRepos.map((repo) => (
              <button
                key={repo.id}
                className="gh-repo-item"
                onClick={() => { onClone(repo.clone_url, repo.name); onClose() }}
              >
                <div className="gh-repo-main">
                  <span className="gh-repo-lock">
                    {repo.private ? <Lock size={10} /> : <Unlock size={10} />}
                  </span>
                  <span className="gh-repo-name">{repo.full_name}</span>
                  {repo.language && <span className="gh-repo-lang">{repo.language}</span>}
                </div>
                {repo.description && (
                  <div className="gh-repo-desc truncate">{repo.description}</div>
                )}
              </button>
            ))}
            {!loadingRepos && filteredRepos.length === 0 && query && (
              <div className="gh-empty">Keine Repos gefunden.</div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
