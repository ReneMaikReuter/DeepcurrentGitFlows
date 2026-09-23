import { useState } from 'react'
import { useRepoStore } from '../../store/repoStore'
import { useT } from '../../i18n/useT'
import './CommitPanel.css'

export function CommitPanel() {
  const t = useT()
  const { changedFiles, selectedFiles, commit, isSyncing, isCommitting } = useRepoStore()
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  const selectedCount = selectedFiles.size > 0 ? selectedFiles.size : changedFiles.length
  const canCommit = message.trim().length > 0 && selectedCount > 0 && !isCommitting && !isSyncing

  const handleCommit = async (pushAfter: boolean) => {
    if (!canCommit) return
    setError(null)

    const result = await commit(message.trim(), pushAfter)

    if (result.success) {
      setMessage('')
    } else {
      setError(result.error ?? 'Commit failed.')
    }
  }

  return (
    <div className="commit-panel">
      <div className="commit-summary">
        {selectedFiles.size > 0 ? (
          <span>{selectedFiles.size} {t('commit_files_selected')}</span>
        ) : (
          <span>{changedFiles.length} {t('commit_files_all')}</span>
        )}
      </div>

      <textarea
        className="commit-message"
        placeholder={t('commit_placeholder')}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        disabled={isCommitting || isSyncing}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            handleCommit(false)
          }
        }}
      />

      {error && <div className="error-banner">{error}</div>}

      <div className="commit-actions">
        <button
          className="btn btn-secondary"
          onClick={() => handleCommit(false)}
          disabled={!canCommit}
        >
          {t('commit_btn')}
        </button>
        <button
          className="btn btn-primary"
          onClick={() => handleCommit(true)}
          disabled={!canCommit}
        >
          {t('commit_and_push')}
        </button>
      </div>
    </div>
  )
}
