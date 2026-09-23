import { useState } from 'react'
import { Modal } from './Modal'
import { useRepoStore } from '../../store/repoStore'

interface BranchSwitchModalProps {
  targetBranch: string
  skipUeCheck?: boolean
  onClose: () => void
}

export function BranchSwitchModal({ targetBranch, skipUeCheck = false, onClose }: BranchSwitchModalProps) {
  const { switchBranch } = useRepoStore()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStash = async () => {
    setBusy(true)
    setError(null)
    const result = await switchBranch(targetBranch, skipUeCheck, true)
    setBusy(false)
    if (result.error && !result.requiresAction) {
      setError(result.error)
    } else {
      onClose()
    }
  }

  return (
    <Modal
      title="Uncommitted changes"
      onClose={onClose}
      width={380}
      footer={
        <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      }
    >
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        You have uncommitted changes. What do you want to do before switching to{' '}
        <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: '3px' }}>
          {targetBranch}
        </code>
        ?
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
        <OptionButton
          title="Stash changes"
          description="Save your changes temporarily and switch branch"
          onClick={handleStash}
          disabled={busy}
        />
        <OptionButton
          title="Commit first"
          description="Cancel and commit your changes before switching"
          onClick={onClose}
          disabled={busy}
        />
      </div>
    </Modal>
  )
}

function OptionButton({ title, description, onClick, disabled }: {
  title: string
  description: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'var(--bg-app)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '10px 12px',
        textAlign: 'left',
        width: '100%',
        cursor: 'pointer',
        transition: 'border-color 0.1s, background 0.1s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-app)' }}
    >
      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 3 }}>{description}</div>
    </button>
  )
}
