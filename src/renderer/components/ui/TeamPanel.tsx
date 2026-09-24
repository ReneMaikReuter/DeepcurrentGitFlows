import { useState, useEffect } from 'react'
import { RefreshCw, Lock, Unlock, ChevronRight, ChevronDown, GitBranch } from 'lucide-react'
import { useRepoStore } from '../../store/repoStore'
import { ipc, IPC } from '../../hooks/useIpc'
import { toast } from '../../store/toastStore'
import type { LfsLock } from '../../../shared/types'
import './TeamPanel.css'

function timeAgo(ms: number | null): string {
  if (!ms) return ''
  const diff = Date.now() - ms
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (d > 0) return `vor ${d}d`
  if (h > 0) return `vor ${h}h`
  if (m > 0) return `vor ${m}m`
  return 'gerade eben'
}


interface PersonEntry {
  name: string
  branches: string[]
  locks: LfsLock[]
  isMe: boolean
}

interface TeamPanelProps {
  expanded?: boolean
}

export function TeamPanel({ expanded = false }: TeamPanelProps) {
  const { currentRepo, currentBranch, changedFiles, refreshBranches } = useRepoStore()
  const [locks, setLocks] = useState<LfsLock[]>([])
  const [myName, setMyName] = useState<string>('')
  const [activity, setActivity] = useState<Record<string, string[]>>({})
  const [working, setWorking] = useState<string | null>(null)
  const [confirmForce, setConfirmForce] = useState<{ lockId: string; path: string } | null>(null)
  const [openCards, setOpenCards] = useState<Set<string>>(new Set(['me']))
  const [refreshing, setRefreshing] = useState(false)

  const loadLocks = async () => {
    if (!currentRepo) return
    const list = await ipc.invoke<LfsLock[]>(IPC.LFS_LIST_LOCKS, currentRepo.path)
    setLocks(Array.isArray(list) ? list : [])
  }

  const loadActivity = async () => {
    if (!currentRepo) return
    const result = await ipc.invoke<Record<string, string[]>>(IPC.TEAM_ACTIVITY, currentRepo.path)
    if (result && typeof result === 'object') setActivity(result)
  }

  useEffect(() => {
    ;(window as any).deepcurrent?.invoke('git:user-info', currentRepo?.path)
      .then((info: { name: string } | null) => { if (info?.name) setMyName(info.name) })
      .catch(() => {})
  }, [currentRepo?.path])

  useEffect(() => {
    loadLocks()
    loadActivity()
    const lockInterval = setInterval(loadLocks, 5000)
    const activityInterval = setInterval(loadActivity, 30000)
    return () => { clearInterval(lockInterval); clearInterval(activityInterval) }
  }, [currentRepo?.path])

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([loadLocks(), loadActivity(), refreshBranches()])
    setRefreshing(false)
  }

  const handleUnlock = async (lockId: string, path: string, force = false) => {
    if (!currentRepo) return
    setWorking(lockId)
    const res = await ipc.invoke<{ success: boolean; error: string | null }>(IPC.LFS_UNLOCK, currentRepo.path, path, force)
    setWorking(null)
    if (res.success) {
      toast.ok(`"${path.split('/').pop() ?? path}" entsperrt.`)
      await loadLocks()
    } else if (!force && res.error?.toLowerCase().includes('uncommitted')) {
      setConfirmForce({ lockId, path })
    } else {
      toast.err(res.error ?? 'Unlock fehlgeschlagen.')
    }
  }

  const handleLock = async (path: string) => {
    if (!currentRepo) return
    setWorking(path)
    const res = await ipc.invoke<{ success: boolean; error: string | null }>(IPC.LFS_LOCK, currentRepo.path, path)
    setWorking(null)
    if (res.success) { toast.ok(`"${path.split('/').pop() ?? path}" gesperrt.`); await loadLocks() }
    else toast.err(res.error ?? 'Lock fehlgeschlagen.')
  }

  const toggleCard = (name: string) => {
    setOpenCards((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  // Build person map from recent git activity + LFS locks
  const personMap = new Map<string, PersonEntry>()
  const meKey = myName || 'Du'

  const addPerson = (name: string, branch?: string, isMe = false) => {
    if (!name) return
    const existing = personMap.get(name) ?? { name, branches: [], locks: [], isMe }
    if (branch && !existing.branches.includes(branch)) existing.branches.push(branch)
    existing.isMe = existing.isMe || isMe
    personMap.set(name, existing)
  }

  // My own entry
  addPerson(meKey, currentBranch ?? undefined, true)

  // Others from recent git activity (last 30 days on remote branches)
  for (const [author, authorBranches] of Object.entries(activity)) {
    if (author === meKey) continue
    for (const branch of authorBranches) addPerson(author, branch)
  }

  // Add lock owners (they're definitely active)
  for (const lock of locks) {
    if (!lock.owner) continue
    const isLockMe = lock.owner === meKey
    addPerson(lock.owner, undefined, isLockMe)
    const entry = personMap.get(lock.owner)!
    if (!entry.locks.find((l) => l.id === lock.id)) entry.locks.push(lock)
  }

  const persons = Array.from(personMap.values()).sort((a, b) => {
    if (a.isMe) return -1
    if (b.isMe) return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className={`team-panel ${expanded ? 'expanded' : ''}`}>
      <div className="team-header">
        <span className="team-label">Team</span>
        <button className={`btn-icon${refreshing ? ' spin' : ''}`} title="Aktualisieren" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw size={11} strokeWidth={2} />
        </button>
      </div>

      {confirmForce && (
        <div className="team-lock-msg team-lock-msg--err">
          <span>Datei hat ungespeicherte Änderungen. Trotzdem entsperren?</span>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8, height: 18, fontSize: 10, padding: '0 6px' }}
            onClick={() => { const cf = confirmForce; setConfirmForce(null); handleUnlock(cf.lockId, cf.path, true) }}>
            Ja
          </button>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 4, height: 18, fontSize: 10, padding: '0 6px' }}
            onClick={() => setConfirmForce(null)}>
            Nein
          </button>
        </div>
      )}

      <div className="team-persons">
        {persons.map((person) => {
          const isOpen = openCards.has(person.name)
          const myFiles = person.isMe ? changedFiles : []
          const hasContent = person.locks.length > 0 || myFiles.length > 0
          const summary: string[] = []
          if (myFiles.length > 0) summary.push(`${myFiles.length} Änderung${myFiles.length !== 1 ? 'en' : ''}`)
          if (person.locks.length > 0) summary.push(`${person.locks.length} gesperrt`)

          return (
            <div key={person.name} className="team-person-card">
              {/* Card header — always visible */}
              <button
                className={`team-person-header${isOpen ? ' open' : ''}`}
                onClick={() => hasContent && toggleCard(person.name)}
                style={{ cursor: hasContent ? 'pointer' : 'default' }}
              >
                <div className="team-person-avatar" style={person.isMe ? { background: 'var(--accent-dim)', color: 'var(--accent)' } : {}}>
                  {person.isMe ? 'Du' : person.name.charAt(0).toUpperCase()}
                </div>
                <div className="team-person-info">
                  <div className="team-person-name">{person.isMe ? `Du (${person.name})` : person.name}</div>
                  {person.branches.length > 0 && (
                    <div className="team-person-branch">
                      <GitBranch size={9} strokeWidth={2} />
                      {person.branches.join(', ')}
                    </div>
                  )}
                  {summary.length > 0 && (
                    <div className="team-person-summary">{summary.join(' · ')}</div>
                  )}
                  {summary.length === 0 && (
                    <div className="team-person-summary" style={{ color: 'var(--text-disabled)' }}>Keine Aktivität</div>
                  )}
                </div>
                {hasContent && (
                  <div className="team-person-chevron">
                    {isOpen ? <ChevronDown size={12} strokeWidth={2} /> : <ChevronRight size={12} strokeWidth={2} />}
                  </div>
                )}
              </button>

              {/* Expandable content */}
              {isOpen && hasContent && (
                <div className="team-person-content">
                  {/* Own changed files */}
                  {myFiles.length > 0 && (
                    <div className="team-section">
                      <div className="team-section-label">In Bearbeitung</div>
                      {myFiles.map((f) => {
                        const myLock = person.locks.find((l) => l.path === f.path)
                        const STATUS: Record<string, string> = { modified: 'M', added: 'A', deleted: 'D', renamed: 'R', untracked: '?', conflicted: '!' }
                        return (
                          <div key={f.path} className={`team-file ${myLock ? 'team-file--locked' : ''}`}>
                            <span className={`team-file-status team-file-status--${f.status}`}>{STATUS[f.status] ?? '?'}</span>
                            <span className="team-file-name">{f.path}</span>
                            {myLock ? (
                              <button className="team-lock-btn" title="Entsperren" disabled={working === myLock.id}
                                onClick={() => handleUnlock(myLock.id, myLock.path)}>
                                <Unlock size={10} strokeWidth={2} />
                              </button>
                            ) : f.path.match(/\.(uasset|umap|ubulk|uexp)$/i) ? (
                              <button className="team-lock-btn" title="Sperren" disabled={working === f.path}
                                onClick={() => handleLock(f.path)}>
                                <Lock size={10} strokeWidth={2} />
                              </button>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Locks (own or others) */}
                  {person.locks.filter((l) => !myFiles.find((f) => f.path === l.path)).length > 0 && (
                    <div className="team-section">
                      <div className="team-section-label">Gesperrte Assets</div>
                      {person.locks.filter((l) => !myFiles.find((f) => f.path === l.path)).map((lock) => (
                        <div key={lock.id} className="team-file team-file--locked">
                          <Lock size={9} strokeWidth={2} style={{ color: person.isMe ? 'var(--accent)' : 'var(--warning)', flexShrink: 0 }} />
                          <span className="team-file-name">{lock.path}</span>
                          {lock.lockedAt && <span className="team-file-time">{timeAgo(lock.lockedAt)}</span>}
                          {person.isMe && (
                            <button className="team-lock-btn" title="Entsperren" disabled={working === lock.id}
                              onClick={() => handleUnlock(lock.id, lock.path)}>
                              <Unlock size={10} strokeWidth={2} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {persons.length === 0 && (
          <div className="team-empty">Keine Team-Mitglieder gefunden.</div>
        )}
      </div>
    </div>
  )
}
