import { useState, useEffect, useRef } from 'react'
import { GitBranch, Plus, ArrowUp, ArrowDown, Upload, GitMerge, Archive, Trash2, Merge, ChevronDown, ChevronRight, Pencil, Download, RefreshCw } from 'lucide-react'
import { useRepoStore } from '../../store/repoStore'
import { ipc, IPC } from '../../hooks/useIpc'
import { BranchSwitchModal } from './BranchSwitchModal'
import { RemoteSetupModal } from './RemoteSetupModal'
import { BackupRestoreModal } from './BackupRestoreModal'
import { toast } from '../../store/toastStore'
import { useT } from '../../i18n/useT'
import './SidebarPanel.css'

export function SidebarPanel() {
  const t = useT()
  const { currentRepo, currentBranch, branches, switchBranch, createBranch, refreshBranches, refreshStatus } = useRepoStore()
  const [showCreateBranch, setShowCreateBranch] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [createFromBranch, setCreateFromBranch] = useState<string>('')
  const [switching, setSwitching] = useState(false)
  const [switchModal, setSwitchModal] = useState<{ branch: string; skipUeCheck: boolean } | null>(null)
  const [pushing, setPushing] = useState(false)
  const [showRemoteSetup, setShowRemoteSetup] = useState(false)
  const [showBackup, setShowBackup] = useState(false)
  const [confirmDeleteBranch, setConfirmDeleteBranch] = useState<string | null>(null)
  const [deletingBranch, setDeletingBranch] = useState(false)
  const [confirmMergeBranch, setConfirmMergeBranch] = useState<string | null>(null)
  const [confirmMergeInto, setConfirmMergeInto] = useState<string | null>(null)
  const [merging, setMerging] = useState(false)
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null)
  const [ueConfirmSwitch, setUeConfirmSwitch] = useState<string | null>(null)
  const [confirmDeleteRemote, setConfirmDeleteRemote] = useState<string | null>(null)
  const [deletingRemote, setDeletingRemote] = useState(false)
  const [renamingBranch, setRenamingBranch] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [checkingOutRemote, setCheckingOutRemote] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [confirmMergeRemote, setConfirmMergeRemote] = useState<string | null>(null)
  const [localExpanded, setLocalExpanded] = useState<boolean>(() => {
    try { return localStorage.getItem('sidebar-local-expanded') !== 'false' } catch { return true }
  })
  const [originExpanded, setOriginExpanded] = useState<boolean>(() => {
    try { return localStorage.getItem('sidebar-origin-expanded') !== 'false' } catch { return true }
  })
  const [branchOrder, setBranchOrder] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('sidebar-branch-order') ?? '[]') } catch { return [] }
  })
  const dragBranch = useRef<string | null>(null)
  const dragOver = useRef<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const toggleLocal = () => setLocalExpanded((v) => { const n = !v; try { localStorage.setItem('sidebar-local-expanded', String(n)) } catch {} return n })
  const toggleOrigin = () => setOriginExpanded((v) => { const n = !v; try { localStorage.setItem('sidebar-origin-expanded', String(n)) } catch {} return n })

  // Auto-refresh branches every 60s so remote activity (behindBy) is detected
  useEffect(() => {
    if (!currentRepo) return
    const interval = setInterval(() => refreshBranches(), 60000)
    return () => clearInterval(interval)
  }, [currentRepo?.path])

  if (!currentRepo) return null

  const localBranches = branches.filter((b) => !b.isRemote)
  const originBranches = branches.filter((b) => b.isRemote)

  // If the branch list is empty but we know the current branch (unborn branch —
  // exists in git symbolic-ref but has no commits yet), show it as a stub.
  const rawLocalBranches =
    localBranches.length === 0 && currentBranch
      ? [{ name: currentBranch, isCurrent: true, isRemote: false, upstream: null, aheadBy: 0, behindBy: 0, lastCommitHash: null, lastCommitMessage: null, lastCommitAuthor: null, lastCommitDate: null, parentBranch: null, activeUsers: [] }]
      : localBranches
  const displayBranches = branchOrder.length > 0
    ? [...rawLocalBranches].sort((a, b) => {
        const ai = branchOrder.indexOf(a.name)
        const bi = branchOrder.indexOf(b.name)
        if (ai === -1 && bi === -1) return 0
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
    : rawLocalBranches

  const handleBranchDrop = () => {
    if (!dragBranch.current || !dragOver.current || dragBranch.current === dragOver.current) {
      setDropTarget(null)
      dragBranch.current = null
      dragOver.current = null
      return
    }
    const names = displayBranches.map((b) => b.name)
    const from = names.indexOf(dragBranch.current)
    const to = names.indexOf(dragOver.current)
    if (from === -1 || to === -1) { setDropTarget(null); return }
    names.splice(from, 1)
    names.splice(to, 0, dragBranch.current)
    setBranchOrder(names)
    try { localStorage.setItem('sidebar-branch-order', JSON.stringify(names)) } catch {}
    dragBranch.current = null
    dragOver.current = null
    setDropTarget(null)
  }

  const handlePushBranch = async () => {
    if (!currentRepo || !currentBranch) return
    setPushing(true)
    await ipc.invoke(IPC.BRANCH_PUSH, currentRepo.path, currentBranch)
    await refreshBranches()
    setPushing(false)
  }

  const handleBranchClick = (name: string) => {
    if (name === currentBranch) return
    if (pendingSwitch === name) {
      setPendingSwitch(null)
      handleSwitch(name)
    } else {
      setPendingSwitch(name)
      setTimeout(() => setPendingSwitch((prev) => (prev === name ? null : prev)), 4000)
    }
  }

  const handleSwitch = async (name: string, forceSkipUe = false) => {
    if (name === currentBranch) return
    setSwitching(true)
    const result = await switchBranch(name, forceSkipUe)
    setSwitching(false)
    if (result.requiresAction === 'ue_running') {
      setUeConfirmSwitch(name)
    } else if (result.requiresAction) {
      setSwitchModal({ branch: name, skipUeCheck: forceSkipUe })
    } else if (result.error) {
      toast.err(result.error ?? '')
    }
  }

  const handleMergeBranch = async (name: string) => {
    if (confirmMergeBranch !== name) {
      setConfirmMergeBranch(name)
      setConfirmDeleteBranch(null)
      return
    }
    if (!currentRepo) return

    // Block merge if UE is running
    const ueRunning = await ipc.invoke<boolean>(IPC.UNREAL_IS_RUNNING)
    if (ueRunning) {
      toast.err('Unreal Engine läuft. Bitte UE5 schliessen bevor du mergst.')
      setConfirmMergeBranch(null)
      return
    }

    setMerging(true)
    const res = await ipc.invoke<{ success: boolean; alreadyUpToDate?: boolean; error?: string; hasConflict?: boolean }>(
      IPC.BRANCH_MERGE, currentRepo.path, name
    )
    setMerging(false)
    setConfirmMergeBranch(null)
    if (res.success) {
      if (res.alreadyUpToDate) {
        toast.info(`Bereits aktuell. Keine Änderungen von "${name}" zu mergen.`)
      } else {
        toast.ok(`"${name}" erfolgreich in "${currentBranch}" gemergt.`)
        await refreshBranches()
        await refreshStatus()
      }
    } else {
      toast.err(res.hasConflict
        ? `Konflikt beim Mergen von "${name}". Bitte manuell auflösen.`
        : res.error ?? 'Merge fehlgeschlagen.')
    }
  }

  const handleMergeCurrentInto = async (targetBranch: string) => {
    if (confirmMergeInto !== targetBranch) {
      setConfirmMergeInto(targetBranch)
      setConfirmDeleteBranch(null)
      setConfirmMergeBranch(null)
      return
    }
    if (!currentRepo || !currentBranch) return

    // Check for LFS locks held by other users — those files can't be overwritten
    const [locks, ghUser] = await Promise.all([
      ipc.invoke<{ success: boolean; locks: import('../../../shared/types').LfsLock[] }>(IPC.LFS_LIST_LOCKS, currentRepo.path),
      ipc.invoke<import('../../../shared/types').GitHubUser | null>(IPC.GITHUB_GET_USER),
    ])
    const myLogin = ghUser?.login ?? null
    const foreignLocks = (locks.locks ?? []).filter((l) => myLogin ? l.owner !== myLogin : false)
    if (foreignLocks.length > 0) {
      const names = foreignLocks.slice(0, 3).map((l) => l.path.split(/[\\/]/).pop()).join(', ')
      toast.err(`Merge blockiert: ${foreignLocks.length} Datei(en) sind von anderen gelockt (${names}${foreignLocks.length > 3 ? ', …' : ''}).`)
      setConfirmMergeInto(null)
      return
    }

    setMerging(true)
    setConfirmMergeInto(null)

    // Switch to target, merge current branch in, switch back (skipUeCheck=true: UE check not needed here)
    const switchRes = await ipc.invoke<{ success: boolean; requiresAction: string | null; error: string | null }>(
      IPC.BRANCH_SWITCH, currentRepo.path, targetBranch, false, true
    )
    if (!switchRes.success) {
      setMerging(false)
      toast.err(switchRes.error ?? `Wechsel zu "${targetBranch}" fehlgeschlagen.`)
      return
    }

    const mergeRes = await ipc.invoke<{ success: boolean; alreadyUpToDate?: boolean; error?: string; hasConflict?: boolean }>(
      IPC.BRANCH_MERGE, currentRepo.path, currentBranch
    )

    // Switch back to original branch regardless of merge result (skipUeCheck=true)
    const switchBackRes = await ipc.invoke<{ success: boolean; requiresAction: string | null; error: string | null }>(
      IPC.BRANCH_SWITCH, currentRepo.path, currentBranch, false, true
    )
    await refreshBranches()
    await refreshStatus()
    setMerging(false)

    if (!switchBackRes.success) {
      toast.err(`Merge auf "${targetBranch}" abgeschlossen, aber Rueckkehr zu "${currentBranch}" fehlgeschlagen. Du bist noch auf "${targetBranch}".`)
      return
    }

    if (mergeRes.success) {
      if (mergeRes.alreadyUpToDate) {
        toast.info(`"${targetBranch}" ist bereits aktuell.`)
      } else {
        toast.ok(`"${currentBranch}" erfolgreich in "${targetBranch}" gemergt.`)
      }
    } else {
      toast.err(mergeRes.hasConflict
        ? `Konflikt beim Mergen in "${targetBranch}". Bitte manuell auflösen.`
        : mergeRes.error ?? 'Merge fehlgeschlagen.')
    }
  }

  const handleDeleteBranch = async (name: string) => {
    if (confirmDeleteBranch !== name) {
      setConfirmDeleteBranch(name)
      return
    }
    if (!currentRepo) return
    setDeletingBranch(true)
    const res = await ipc.invoke<{ success: boolean; error: string | null }>(IPC.BRANCH_DELETE, currentRepo.path, name, true, true)
    setDeletingBranch(false)
    setConfirmDeleteBranch(null)
    if (res && !res.success && res.error) {
      toast.err(res.error)
    } else {
      await refreshBranches()
    }
  }

  const handleDeleteRemoteBranch = async (fullName: string) => {
    if (confirmDeleteRemote !== fullName) {
      setConfirmDeleteRemote(fullName)
      return
    }
    if (!currentRepo) return
    setDeletingRemote(true)
    const res = await ipc.invoke<{ success: boolean; error: string | null }>(IPC.BRANCH_DELETE_REMOTE, currentRepo.path, fullName)
    setDeletingRemote(false)
    setConfirmDeleteRemote(null)
    if (res.success) {
      toast.ok(`Branch "${fullName.replace(/^origin\//, '')}" vom Server gelöscht.`)
      await refreshBranches()
    } else {
      toast.err(res.error ?? 'Löschen fehlgeschlagen.')
    }
  }

  const handleRenameBranch = async (oldName: string) => {
    if (!currentRepo || !renameValue.trim() || renameValue.trim() === oldName) {
      setRenamingBranch(null)
      return
    }
    const res = await ipc.invoke<{ success: boolean; error: string | null }>(IPC.BRANCH_RENAME, currentRepo.path, oldName, renameValue.trim())
    if (res.success) {
      toast.ok(`Branch umbenannt: "${oldName}" → "${renameValue.trim()}"`)
      await refreshBranches()
    } else {
      toast.err(res.error ?? 'Umbenennen fehlgeschlagen.')
    }
    setRenamingBranch(null)
  }

  const handleMergeRemote = async (remoteName: string) => {
    if (!currentRepo) return
    const res = await ipc.invoke<{ success: boolean; alreadyUpToDate?: boolean; error?: string; hasConflict?: boolean }>(
      IPC.BRANCH_MERGE, currentRepo.path, remoteName
    )
    setConfirmMergeRemote(null)
    if (res.success) {
      if (res.alreadyUpToDate) {
        toast.info(`Bereits aktuell. Keine Änderungen von "${remoteName}" zu mergen.`)
      } else {
        const short = remoteName.replace(/^origin\//, '')
        toast.ok(`"${short}" erfolgreich in "${currentBranch}" gemergt.`)
        await refreshBranches()
        await refreshStatus()
      }
    } else {
      toast.err(res.hasConflict ? `Konflikt beim Mergen von "${remoteName}". Bitte manuell auflösen.` : res.error ?? 'Merge fehlgeschlagen.')
    }
  }

  const handleCheckoutRemote = async (remoteName: string) => {
    if (!currentRepo) return
    setCheckingOutRemote(remoteName)
    const res = await ipc.invoke<{ success: boolean; error: string | null }>(IPC.BRANCH_CHECKOUT_REMOTE, currentRepo.path, remoteName)
    if (res.success) {
      const shortName = remoteName.replace(/^origin\//, '')
      toast.ok(`Branch "${shortName}" lokal ausgecheckt.`)
      await refreshBranches()
      await switchBranch(shortName)
    } else {
      toast.err(res.error ?? 'Auschecken fehlgeschlagen.')
    }
    setCheckingOutRemote(null)
  }

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return
    setCreateError(null)
    const from = createFromBranch || currentBranch || 'HEAD'
    const result = await createBranch(newBranchName.trim(), from)
    if (result.success) {
      setNewBranchName('')
      setShowCreateBranch(false)
      setCreateError(null)
    } else {
      setCreateError(result.error ?? 'Failed to create branch.')
    }
  }

  return (
    <div className="sidebar-panel">
      {switchModal && (
        <BranchSwitchModal targetBranch={switchModal.branch} skipUeCheck={switchModal.skipUeCheck} onClose={() => setSwitchModal(null)} />
      )}
      {showRemoteSetup && (
        <RemoteSetupModal onClose={() => setShowRemoteSetup(false)} />
      )}
      {showBackup && (
        <BackupRestoreModal onClose={() => setShowBackup(false)} />
      )}

      {/* Repo info */}
      <div className="sidebar-repo">
        <div className="sidebar-repo-name-row">
          <div className="sidebar-repo-name truncate">{currentRepo.name}</div>
          <button className="btn-icon" title="Backups" onClick={() => setShowBackup(true)}>
            <Archive size={12} strokeWidth={1.8} />
          </button>
        </div>
        {currentRepo.remote ? (
          <button
            className="sidebar-connect-remote sidebar-connect-remote--connected"
            onClick={() => setShowRemoteSetup(true)}
            title="Manage remote"
          >
            <GitMerge size={11} strokeWidth={2} />
            <span className="truncate">{currentRepo.remote.replace(/^https?:\/\/(www\.)?github\.com\//, '')}</span>
          </button>
        ) : (
          <button
            className="sidebar-connect-remote"
            onClick={() => setShowRemoteSetup(true)}
            title="Connect to GitHub"
          >
            <GitMerge size={11} strokeWidth={2} />
            {t('sidebar_connect_remote')}
          </button>
        )}
      </div>

      {/* Merge result message */}

      {/* Branches */}
      <div className="sidebar-branches">
        {/* Local branches section */}
        <div className="sidebar-branches-header sidebar-branches-header--clickable" onClick={toggleLocal}>
          <span className="sidebar-category-chevron">
            {localExpanded ? <ChevronDown size={11} strokeWidth={2} /> : <ChevronRight size={11} strokeWidth={2} />}
          </span>
          <span className="sidebar-branches-label">{t('sidebar_branches')}</span>
          {/* Show push-to-remote button when current branch has no upstream */}
          {currentBranch && !branches.find((b) => b.isCurrent)?.upstream && (
            <button
              className="btn-icon"
              title={`Publish "${currentBranch}" to remote`}
              onClick={(e) => { e.stopPropagation(); handlePushBranch() }}
              disabled={pushing}
            >
              <Upload size={12} strokeWidth={2} />
            </button>
          )}
          <button
            className={`btn-icon${refreshing ? ' spin' : ''}`}
            title="Branches aktualisieren"
            onClick={async (e) => {
              e.stopPropagation()
              setRefreshing(true)
              await refreshBranches()
              setRefreshing(false)
            }}
            disabled={refreshing}
          >
            <RefreshCw size={12} strokeWidth={2} />
          </button>
          <button
            className="btn-icon"
            title="New branch"
            onClick={(e) => { e.stopPropagation(); setShowCreateBranch(!showCreateBranch) }}
          >
            <Plus size={13} strokeWidth={2} />
          </button>
        </div>

        {localExpanded && displayBranches.map((branch) => {
          const isDirty = branch.isCurrent && (branch.aheadBy > 0 || branch.behindBy > 0)
          const isConfirmingDelete = confirmDeleteBranch === branch.name
          return (
            <div
              key={branch.name}
              className={`branch-item-row ${branch.isCurrent ? 'active' : ''} ${dropTarget === branch.name && dragBranch.current !== branch.name ? 'drag-over' : ''}`}
              draggable
              onDragStart={() => { dragBranch.current = branch.name }}
              onDragEnter={() => { dragOver.current = branch.name; setDropTarget(branch.name) }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleBranchDrop}
              onDragEnd={() => { setDropTarget(null); dragBranch.current = null; dragOver.current = null }}
              style={{ cursor: 'grab' }}
            >
              <button
                className="branch-item-btn"
                onClick={() => { setConfirmDeleteBranch(null); setConfirmMergeBranch(null); setConfirmMergeInto(null); handleBranchClick(branch.name) }}
                disabled={switching}
              >
                <span
                  className={`branch-indicator${isDirty ? ' branch-indicator--dirty' : ''}${branch.activeUsers?.length > 0 ? ' branch-indicator--active' : ''}`}
                  title={branch.activeUsers?.length > 0 ? `Aktiv: ${branch.activeUsers.join(', ')}` : undefined}
                />
                <GitBranch size={12} strokeWidth={1.8} style={{ flexShrink: 0, color: branch.isCurrent ? 'var(--accent)' : 'var(--text-secondary)' }} />
                <span className="branch-name-wrap">
                  <span className="branch-name truncate">{branch.name}</span>
                  {branch.parentBranch && (
                    <span className="branch-parent">von {branch.parentBranch}</span>
                  )}
                  {!branch.isCurrent && branch.lastCommitAuthor && (
                    <span className="branch-last-author" title={`Zuletzt: ${branch.lastCommitAuthor}`}>
                      {branch.lastCommitAuthor.split(' ')[0]}
                    </span>
                  )}
                </span>
                {branch.upstream && (
                  <span
                    className={`branch-status-dot ${branch.behindBy > 0 ? 'branch-status-dot--behind' : branch.aheadBy > 0 ? 'branch-status-dot--ahead' : 'branch-status-dot--synced'}`}
                    title={branch.behindBy > 0 ? `${branch.behindBy} Commits hinter Remote` : branch.aheadBy > 0 ? `${branch.aheadBy} Commits vor Remote` : 'Synchron mit Remote'}
                  />
                )}
                {branch.isCurrent && (
                  <span className="branch-badge">
                    {branch.aheadBy > 0 && (
                      <span className="branch-badge-ahead">
                        <ArrowUp size={10} strokeWidth={2.5} style={{ display: 'inline' }} />
                        {branch.aheadBy}
                      </span>
                    )}
                    {branch.behindBy > 0 && (
                      <span className="branch-badge-behind">
                        <ArrowDown size={10} strokeWidth={2.5} style={{ display: 'inline' }} />
                        {branch.behindBy}
                      </span>
                    )}
                  </span>
                )}
              </button>
              {branch.isCurrent && branch.aheadBy > 0 && (
                <button
                  className="branch-push-btn"
                  title={`Push ${branch.aheadBy} commit(s) to remote`}
                  onClick={handlePushBranch}
                  disabled={pushing}
                >
                  <Upload size={11} strokeWidth={2} />
                </button>
              )}
              {!branch.isCurrent && ueConfirmSwitch === branch.name ? (
                <div className="branch-delete-confirm">
                  <span className="branch-delete-confirm-text" style={{ fontSize: 9, color: 'var(--warning)' }}>UE laeuft. Trotzdem?</span>
                  <button className="btn btn-primary btn-sm" onClick={() => { setUeConfirmSwitch(null); handleSwitch(branch.name, true) }} style={{ height: 18, fontSize: 10 }}>Ja</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setUeConfirmSwitch(null)} style={{ height: 18, fontSize: 10 }}>Nein</button>
                </div>
              ) : !branch.isCurrent && pendingSwitch === branch.name ? (
                <div className="branch-delete-confirm">
                  <span className="branch-delete-confirm-text">Wechseln?</span>
                  <button className="btn btn-primary btn-sm" onClick={() => { setPendingSwitch(null); handleSwitch(branch.name) }} style={{ height: 18, fontSize: 10 }}>Ja</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setPendingSwitch(null)} style={{ height: 18, fontSize: 10 }}>Nein</button>
                </div>
              ) : !branch.isCurrent && renamingBranch === branch.name ? (
                <div className="branch-rename-row">
                  <input
                    className="branch-rename-input"
                    value={renameValue}
                    autoFocus
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameBranch(branch.name)
                      if (e.key === 'Escape') setRenamingBranch(null)
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button className="btn btn-primary btn-sm" style={{ height: 18, fontSize: 10 }} onClick={() => handleRenameBranch(branch.name)}>OK</button>
                  <button className="btn btn-ghost btn-sm" style={{ height: 18, fontSize: 10 }} onClick={() => setRenamingBranch(null)}>✕</button>
                </div>
              ) : !branch.isCurrent && (
                isConfirmingDelete ? (
                  <div className="branch-delete-confirm">
                    <span className="branch-delete-confirm-text">{t('sidebar_deleting')}</span>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteBranch(branch.name)} disabled={deletingBranch} style={{ height: 18, fontSize: 10 }}>{t('sidebar_confirm_yes')}</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteBranch(null)} style={{ height: 18, fontSize: 10 }}>{t('sidebar_confirm_no')}</button>
                  </div>
                ) : confirmMergeInto === branch.name ? (
                  <div className="branch-delete-confirm">
                    <span className="branch-delete-confirm-text" style={{ fontSize: 9 }}>→ {branch.name}?</span>
                    <button className="btn btn-primary btn-sm" onClick={() => handleMergeCurrentInto(branch.name)} disabled={merging} style={{ height: 18, fontSize: 10 }}>{t('sidebar_confirm_yes')}</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmMergeInto(null)} style={{ height: 18, fontSize: 10 }}>{t('sidebar_confirm_no')}</button>
                  </div>
                ) : confirmMergeBranch === branch.name ? (
                  <div className="branch-delete-confirm">
                    <span className="branch-delete-confirm-text" style={{ fontSize: 9 }}>← {branch.name}?</span>
                    <button className="btn btn-primary btn-sm" onClick={() => handleMergeBranch(branch.name)} disabled={merging} style={{ height: 18, fontSize: 10 }}>{t('sidebar_confirm_yes')}</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmMergeBranch(null)} style={{ height: 18, fontSize: 10 }}>{t('sidebar_confirm_no')}</button>
                  </div>
                ) : (
                  <>
                    <button
                      className="branch-delete-btn"
                      title={`Aktuellen Branch "${currentBranch}" in "${branch.name}" mergen`}
                      onClick={() => { setConfirmMergeInto(branch.name); setConfirmMergeBranch(null); setConfirmDeleteBranch(null) }}
                      style={{ color: 'var(--text-secondary)', transform: 'rotate(180deg)' }}
                    >
                      <Merge size={11} strokeWidth={2} />
                    </button>
                    <button
                      className="branch-delete-btn"
                      title={`"${branch.name}" in "${currentBranch}" mergen`}
                      onClick={() => { setConfirmMergeBranch(branch.name); setConfirmMergeInto(null); setConfirmDeleteBranch(null) }}
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <Merge size={11} strokeWidth={2} />
                    </button>
                    <button
                      className="branch-delete-btn"
                      title={`Branch "${branch.name}" umbenennen`}
                      onClick={() => { setRenamingBranch(branch.name); setRenameValue(branch.name); setConfirmDeleteBranch(null); setConfirmMergeBranch(null); setConfirmMergeInto(null) }}
                    >
                      <Pencil size={11} strokeWidth={2} />
                    </button>
                    <button
                      className="branch-delete-btn"
                      title={`Branch "${branch.name}" löschen`}
                      onClick={() => setConfirmDeleteBranch(branch.name)}
                    >
                      <Trash2 size={11} strokeWidth={2} />
                    </button>
                  </>
                )
              )}
            </div>
          )
        })}

        {/* Drop zone at bottom of local branches */}
        {localExpanded && (
          <div
            className={`branch-drop-end${dropTarget === '__end__' ? ' drag-over-end' : ''}`}
            onDragEnter={() => { dragOver.current = '__end__'; setDropTarget('__end__') }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (!dragBranch.current) { setDropTarget(null); return }
              const names = displayBranches.map((b) => b.name)
              const from = names.indexOf(dragBranch.current)
              if (from !== -1) { names.splice(from, 1); names.push(dragBranch.current) }
              setBranchOrder(names)
              try { localStorage.setItem('sidebar-branch-order', JSON.stringify(names)) } catch {}
              dragBranch.current = null; dragOver.current = null; setDropTarget(null)
            }}
          />
        )}

        {/* Origin / remote branches section */}
        {originBranches.length > 0 && (
          <>
            <div className="sidebar-branches-header sidebar-branches-header--clickable sidebar-branches-header--origin" onClick={toggleOrigin}>
              <span className="sidebar-category-chevron">
                {originExpanded ? <ChevronDown size={11} strokeWidth={2} /> : <ChevronRight size={11} strokeWidth={2} />}
              </span>
              <span className="sidebar-branches-label">Origin</span>
            </div>
            {originExpanded && originBranches.filter((b) => !b.name.endsWith('/HEAD')).map((branch) => {
              const shortName = branch.name.replace(/^origin\//, '')
              const isConfirmingDeleteRemote = confirmDeleteRemote === branch.name
              const alreadyLocal = localBranches.some((b) => b.name === shortName)
              const isCheckingOut = checkingOutRemote === branch.name
              return (
                <div key={branch.name} className="branch-item-row branch-item-row--remote">
                  <div className="branch-item-btn" style={{ cursor: 'default' }}>
                    <span className="branch-indicator" style={{ background: 'var(--border-strong)' }} />
                    <GitBranch size={12} strokeWidth={1.8} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                    <span className="branch-name-wrap">
                      <span className="branch-name truncate" style={{ color: 'var(--text-muted)' }}>{shortName}</span>
                      {branch.lastCommitAuthor && (
                        <span className="branch-last-author" title={`Zuletzt: ${branch.lastCommitAuthor}`}>
                          {branch.lastCommitAuthor.split(' ')[0]}
                        </span>
                      )}
                    </span>
                  </div>
                  {isConfirmingDeleteRemote ? (
                    <div className="branch-delete-confirm">
                      <span className="branch-delete-confirm-text" style={{ fontSize: 9 }}>Server?</span>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteRemoteBranch(branch.name)} disabled={deletingRemote} style={{ height: 18, fontSize: 10 }}>Ja</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteRemote(null)} style={{ height: 18, fontSize: 10 }}>Nein</button>
                    </div>
                  ) : confirmMergeRemote === branch.name ? (
                    <div className="branch-delete-confirm">
                      <span className="branch-delete-confirm-text" style={{ fontSize: 9 }}>← {shortName}?</span>
                      <button className="btn btn-primary btn-sm" onClick={() => handleMergeRemote(branch.name)} disabled={merging} style={{ height: 18, fontSize: 10 }}>Ja</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setConfirmMergeRemote(null)} style={{ height: 18, fontSize: 10 }}>Nein</button>
                    </div>
                  ) : (
                    <>
                      <button
                        className="branch-delete-btn"
                        title={`"${shortName}" in "${currentBranch}" mergen`}
                        onClick={() => setConfirmMergeRemote(branch.name)}
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <Merge size={11} strokeWidth={2} />
                      </button>
                      {!alreadyLocal && (
                        <button
                          className="branch-delete-btn"
                          title={`"${shortName}" lokal auschecken`}
                          onClick={() => handleCheckoutRemote(branch.name)}
                          disabled={isCheckingOut}
                          style={{ color: 'var(--accent)' }}
                        >
                          <Download size={11} strokeWidth={2} />
                        </button>
                      )}
                      <button
                        className="branch-delete-btn"
                        title={`"${shortName}" vom Server löschen`}
                        onClick={() => setConfirmDeleteRemote(branch.name)}
                      >
                        <Trash2 size={11} strokeWidth={2} />
                      </button>
                    </>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>

      {showCreateBranch && (
        <div className="create-branch-form">
          <input
            type="text"
            placeholder="feature/my-branch"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateBranch()
              if (e.key === 'Escape') setShowCreateBranch(false)
            }}
            autoFocus
          />
          <div className="create-branch-from" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>{t('sidebar_from')}</span>
            <select
              className="settings-input-sm"
              style={{ flex: 1, height: 22, fontSize: 'var(--text-xs)', padding: '0 4px' }}
              value={createFromBranch || currentBranch || ''}
              onChange={(e) => setCreateFromBranch(e.target.value)}
            >
              {localBranches.map((b) => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
              {originBranches.filter((b) => !b.name.endsWith('/HEAD') && !localBranches.some((l) => l.name === b.name.replace(/^origin\//, ''))).map((b) => {
                const short = b.name.replace(/^origin\//, '')
                return <option key={b.name} value={b.name}>origin/{short}</option>
              })}
            </select>
          </div>
          {createError && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--error)', lineHeight: 1.4 }}>
              {createError}
            </div>
          )}
          <div className="create-branch-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowCreateBranch(false); setCreateError(null) }}>{t('sidebar_cancel')}</button>
            <button className="btn btn-primary btn-sm" onClick={handleCreateBranch}>{t('sidebar_create_branch')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
