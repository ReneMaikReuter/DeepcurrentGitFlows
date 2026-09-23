import { useState, useEffect } from 'react'
import { RefreshCw, ChevronDown, ChevronRight, Lock, Unlock, FileWarning } from 'lucide-react'
import { useRepoStore } from '../../store/repoStore'
import { ipc, IPC } from '../../hooks/useIpc'
import { useT } from '../../i18n/useT'
import type { LfsLock } from '../../../shared/types'
import './TeamPanel.css'

function timeAgo(ms: number | null): string {
  if (!ms) return 'unknown'
  const diff = Date.now() - ms
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return 'just now'
}

function assetName(path: string): string {
  return path.split('/').pop() ?? path
}

interface TeamPanelProps {
  expanded?: boolean
}

export function TeamPanel({ expanded = false }: TeamPanelProps) {
  const t = useT()
  const { team, loadTeam, currentRepo, currentBranch, changedFiles } = useRepoStore()
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set())
  const [locks, setLocks] = useState<LfsLock[]>([])
  const [lockMsg, setLockMsg] = useState<{ ok: boolean; text: string; forceAction?: () => void } | null>(null)
  const [working, setWorking] = useState<string | null>(null)

  const loadLocks = async () => {
    if (!currentRepo) return
    const list = await ipc.invoke<LfsLock[]>(IPC.LFS_LIST_LOCKS, currentRepo.path)
    setLocks(list ?? [])
  }

  useEffect(() => {
    loadTeam()
    loadLocks()
  }, [currentRepo?.path])

  const toggleMember = (branch: string) => {
    setExpandedMembers((prev) => {
      const next = new Set(prev)
      if (next.has(branch)) next.delete(branch)
      else next.add(branch)
      return next
    })
  }

  const handleLock = async (path: string) => {
    if (!currentRepo) return
    setWorking(path)
    setLockMsg(null)
    const res = await ipc.invoke<{ success: boolean; error: string | null }>(IPC.LFS_LOCK, currentRepo.path, path)
    setWorking(null)
    if (res.success) {
      setLockMsg({ ok: true, text: `"${assetName(path)}" gesperrt.` })
      await loadLocks()
    } else {
      setLockMsg({ ok: false, text: res.error ?? 'Lock fehlgeschlagen.' })
    }
  }

  const handleUnlock = async (lockId: string, path: string, force = false) => {
    if (!currentRepo) return
    setWorking(lockId)
    setLockMsg(null)
    const res = await ipc.invoke<{ success: boolean; error: string | null }>(IPC.LFS_UNLOCK, currentRepo.path, path, force)
    setWorking(null)
    if (res.success) {
      setLockMsg({ ok: true, text: `"${assetName(path)}" entsperrt.` })
      await loadLocks()
    } else if (!force && res.error && res.error.toLowerCase().includes('uncommitted')) {
      setLockMsg({
        ok: false,
        text: `Datei hat ungespeicherte Aenderungen. Trotzdem entsperren?`,
        forceAction: () => handleUnlock(lockId, path, true),
      })
    } else {
      setLockMsg({ ok: false, text: res.error ?? 'Unlock fehlgeschlagen.' })
    }
  }

  const myLocks = locks // all locks visible to this client

  if (team.length === 0 && !expanded) return null

  return (
    <div className={`team-panel ${expanded ? 'expanded' : ''}`}>
      <div className="team-header">
        <span className="team-label">Team</span>
        <button className="btn-icon" title="Refresh" onClick={() => { loadTeam(); loadLocks() }}>
          <RefreshCw size={11} strokeWidth={2} />
        </button>
      </div>

      {lockMsg && (
        <div className={`team-lock-msg ${lockMsg.ok ? 'team-lock-msg--ok' : 'team-lock-msg--err'}`}>
          <span onClick={() => setLockMsg(null)}>{lockMsg.text}</span>
          {lockMsg.forceAction && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: 8, height: 18, fontSize: 10, padding: '0 6px' }}
              onClick={() => { setLockMsg(null); lockMsg.forceAction!() }}
            >
              Ja
            </button>
          )}
        </div>
      )}

      {/* LFS Locks section */}
      {myLocks.length > 0 && (
        <div className="team-locks-section">
          <div className="team-locks-title">
            <Lock size={10} strokeWidth={2} />
            {t('team_locked_assets')} ({myLocks.length})
          </div>
          {myLocks.map((lock) => (
            <div key={lock.id} className="team-lock-row">
              <FileWarning size={11} strokeWidth={2} style={{ color: 'var(--warning)', flexShrink: 0 }} />
              <div className="team-lock-info">
                <div className="team-lock-path truncate" title={lock.path}>{assetName(lock.path)}</div>
                <div className="team-lock-owner">{t('team_locked_by')} {lock.owner}{lock.lockedAt ? ` · ${timeAgo(lock.lockedAt)}` : ''}</div>
              </div>
              <button
                className="btn-icon"
                title="Entsperren"
                disabled={working === lock.id}
                onClick={() => handleUnlock(lock.id, lock.path)}
              >
                <Unlock size={11} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* My activity — changed files + own locks */}
      {currentBranch && (
        <div className="team-my-section">
          <div className="team-locks-title">
            {t('team_my_activity')}
          </div>
          <div className="team-member-row" style={{ cursor: 'default' }}>
            <div className="team-avatar" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: 9 }}>Du</div>
            <div className="team-member-info">
              <div className="team-member-name">{t('team_active_branch')}: <strong>{currentBranch}</strong></div>
              {changedFiles.length > 0 ? (
                <div className="team-member-branch">{changedFiles.length} {t('team_files_in_progress')}</div>
              ) : locks.length > 0 ? (
                <div className="team-member-branch">{locks.length} {t('team_locked')}</div>
              ) : (
                <div className="team-member-branch" style={{ color: 'var(--text-disabled)' }}>{t('team_no_changes')}</div>
              )}
            </div>
          </div>

          {/* Changed files */}
          {changedFiles.length > 0 && (
            <div className="team-files" style={{ marginTop: 'var(--sp-2)', maxHeight: 320, overflowY: 'auto' }}>
              {changedFiles.map((f) => {
                const lock = locks.find((l) => l.path === f.path)
                const STATUS: Record<string, string> = { modified: 'M', added: 'A', deleted: 'D', renamed: 'R', untracked: '?', conflicted: '!' }
                return (
                  <div key={f.path} className={`team-file ${lock ? 'team-file--locked' : ''}`}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, width: 12, textAlign: 'center', flexShrink: 0,
                      color: f.status === 'added' || f.status === 'untracked' ? 'var(--success)' :
                             f.status === 'deleted' ? 'var(--error)' :
                             f.status === 'conflicted' ? 'var(--error)' : 'var(--warning)'
                    }}>
                      {STATUS[f.status] ?? '?'}
                    </span>
                    <span className="team-file-name" title={f.path} style={{ wordBreak: 'break-all', lineHeight: 1.3 }}>{f.path}</span>
                    {lock
                      ? <span className="team-file-locked-label">gesperrt</span>
                      : f.path.match(/\.(uasset|umap|ubulk)$/i) && (
                          <button
                            className="team-lock-btn"
                            title={`"${assetName(f.path)}" sperren`}
                            disabled={working === f.path}
                            onClick={() => handleLock(f.path)}
                          >
                            <Lock size={10} strokeWidth={2} />
                          </button>
                        )
                    }
                  </div>
                )
              })}
            </div>
          )}

          {/* LFS locks (assets locked but not necessarily changed) */}
          {locks.filter((l) => !changedFiles.find((f) => f.path === l.path)).length > 0 && (
            <div className="team-files" style={{ marginTop: 'var(--sp-1)' }}>
              {locks.filter((l) => !changedFiles.find((f) => f.path === l.path)).map((lock) => (
                <div key={lock.id} className="team-file team-file--locked">
                  <Lock size={10} strokeWidth={2} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <span className="team-file-name truncate" title={lock.path}>{assetName(lock.path)}</span>
                  <button
                    className="team-lock-btn"
                    style={{ opacity: 1, color: 'var(--text-secondary)' }}
                    title="Entsperren"
                    disabled={working === lock.id}
                    onClick={() => handleUnlock(lock.id, lock.path)}
                  >
                    <Unlock size={10} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Team members */}
      {team.length === 0 ? (
        <div className="team-empty">{t('team_no_members')}</div>
      ) : (
        team.map((member) => {
          const isExpanded = expandedMembers.has(member.branch)
          return (
            <div key={member.branch} className="team-member">
              <div className="team-member-row" onClick={() => member.lastFiles.length > 0 && toggleMember(member.branch)}>
                <div className="team-avatar">{member.name.charAt(0).toUpperCase()}</div>
                <div className="team-member-info">
                  <div className="team-member-name">{member.name}</div>
                  <div className="team-member-branch truncate">{member.branch}</div>
                  {member.lastActivity && (
                    <div className="team-member-time">{timeAgo(member.lastActivity)}</div>
                  )}
                </div>
                {member.lastFiles.length > 0 && (
                  <div className="team-member-meta">
                    <span className="team-file-count">{member.lastFiles.length} file{member.lastFiles.length !== 1 ? 's' : ''}</span>
                    {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  </div>
                )}
              </div>

              {isExpanded && member.lastFiles.length > 0 && (
                <div className="team-files">
                  {member.lastFiles.map((f) => {
                    const lock = locks.find((l) => l.path === f)
                    return (
                      <div key={f} className={`team-file ${lock ? 'team-file--locked' : ''}`}>
                        {lock
                          ? <Lock size={10} strokeWidth={2} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                          : <span className="team-file-dot" />
                        }
                        <span className="team-file-name truncate" title={f}>{assetName(f)}</span>
                        {!lock && f.match(/\.(uasset|umap|ubulk)$/i) && (
                          <button
                            className="team-lock-btn"
                            title={`"${assetName(f)}" sperren`}
                            disabled={working === f}
                            onClick={(e) => { e.stopPropagation(); handleLock(f) }}
                          >
                            <Lock size={10} strokeWidth={2} />
                          </button>
                        )}
                        {lock && (
                          <span className="team-file-locked-label">{t('team_locked')}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
