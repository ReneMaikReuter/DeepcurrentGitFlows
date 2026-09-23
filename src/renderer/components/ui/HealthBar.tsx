import { useRepoStore } from '../../store/repoStore'

interface Props {
  compact?: boolean
}

export function HealthBar({ compact }: Props) {
  const { health, lfsStatus, changedFiles } = useRepoStore()

  const conflicts = changedFiles.filter((f) => f.status === 'conflicted')
  const hasConflicts = conflicts.length > 0
  const lfsProblems = lfsStatus?.pointerFiles.length ?? 0

  const isHealthy = (health?.gitOk ?? false) && (health?.lfsOk ?? false) && !hasConflicts && lfsProblems === 0

  if (compact) {
    // Compact mode: single status indicator for the titlebar
    const dotClass = isHealthy
      ? 'status-dot status-dot-ok'
      : hasConflicts || lfsProblems > 0
        ? 'status-dot status-dot-error'
        : 'status-dot status-dot-warn'

    const label = isHealthy
      ? 'Healthy'
      : hasConflicts
        ? `${conflicts.length} conflict${conflicts.length !== 1 ? 's' : ''}`
        : lfsProblems > 0
          ? `${lfsProblems} LFS pointer${lfsProblems !== 1 ? 's' : ''}`
          : 'Issues'

    return (
      <div className="titlebar-health">
        <span className={dotClass} />
        <span>{label}</span>
      </div>
    )
  }

  // Full mode (not used in titlebar but kept for flexibility)
  return (
    <div style={{ display: 'flex', gap: '12px', padding: '6px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg-surface)' }}>
      <HealthItem ok={health?.gitOk ?? false} label="Git" />
      <HealthItem ok={health?.lfsOk ?? false} label="LFS" warn={lfsProblems > 0} detail={lfsProblems > 0 ? `${lfsProblems} pointer` : undefined} />
      <HealthItem ok={!hasConflicts} label={hasConflicts ? `${conflicts.length} conflicts` : 'No conflicts'} warn={hasConflicts} />
    </div>
  )
}

function HealthItem({ ok, warn, label, detail }: { ok: boolean; warn?: boolean; label: string; detail?: string }) {
  const dotClass = ok && !warn ? 'status-dot status-dot-ok' : warn ? 'status-dot status-dot-warn' : 'status-dot status-dot-error'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <span className={dotClass} />
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{label}</span>
      {detail && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--error)' }}>{detail}</span>}
    </div>
  )
}
