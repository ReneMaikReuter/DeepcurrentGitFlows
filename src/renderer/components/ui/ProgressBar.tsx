import { useRepoStore } from '../../store/repoStore'
import './ProgressBar.css'

export function ProgressBar() {
  const { isSyncing, syncState, isCommitting } = useRepoStore()

  const isActive = isSyncing || isCommitting
  const isDone = !isActive && syncState?.phase === 'done'

  if (!isActive && !isDone) return null

  const steps = syncState?.steps ?? []
  const done  = steps.filter((s) => s.status === 'success' || s.status === 'skipped').length
  const total = steps.length || 1
  const pct   = isActive
    ? (isCommitting ? 50 : Math.max(8, Math.round((done / total) * 100)))
    : 100

  return (
    <div className="progress-bar-track">
      <div
        className={`progress-bar-fill ${isDone ? 'progress-bar-fill--done' : ''} ${isCommitting ? 'progress-bar-fill--indeterminate' : ''}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
