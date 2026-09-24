import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { ipc, IPC } from '../../hooks/useIpc'
import type { ChangedFile, DiffLine, BlameEntry } from '../../../shared/types'
import './DiffViewer.css'

function parseDiff(raw: string): DiffLine[] {
  const lines: DiffLine[] = []
  let oldLine = 0
  let newLine = 0
  for (const raw_line of raw.split('\n')) {
    const line = raw_line.replace(/\r$/, '')
    if (line.startsWith('@@')) {
      const m = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (m) { oldLine = parseInt(m[1]); newLine = parseInt(m[2]) }
      lines.push({ type: 'hunk', content: line })
    } else if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('new file') || line.startsWith('deleted file') || line.startsWith('Binary')) {
      lines.push({ type: 'meta', content: line })
    } else if (line.startsWith('+')) {
      lines.push({ type: 'add', content: line.slice(1), newLine: newLine++ })
    } else if (line.startsWith('-')) {
      lines.push({ type: 'remove', content: line.slice(1), oldLine: oldLine++ })
    } else if (line.startsWith(' ') || line === '') {
      lines.push({ type: 'context', content: line.slice(1), oldLine: oldLine++, newLine: newLine++ })
    }
  }
  return lines.filter((l) => !(l.type === 'meta' && !l.content))
}

function isBinary(raw: string): boolean {
  return raw.includes('Binary files') || raw.includes('\u0000')
}

export function DiffViewer({ repoPath, file }: { repoPath: string; file: ChangedFile | null }) {
  const [diff, setDiff] = useState<DiffLine[]>([])
  const [_rawDiff, setRawDiff] = useState('')
  const [blame, setBlame] = useState<BlameEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [showBlame, setShowBlame] = useState(false)
  const [binary, setBinary] = useState(false)

  useEffect(() => {
    if (!file || !repoPath) { setDiff([]); setRawDiff(''); setBinary(false); return }
    setLoading(true)
    setBlame([])
    ipc.invoke<string>(IPC.GIT_DIFF_FILE, repoPath, file.path, file.isStaged).then((raw) => {
      const r = raw ?? ''
      setRawDiff(r)
      setBinary(isBinary(r))
      setDiff(parseDiff(r))
      setLoading(false)
    })
  }, [file?.path, file?.isStaged, repoPath])

  useEffect(() => {
    if (!showBlame || !file || !repoPath) return
    ipc.invoke<BlameEntry[]>(IPC.GIT_BLAME_FILE, repoPath, file.path).then((entries) => {
      setBlame(entries ?? [])
    })
  }, [showBlame, file?.path, repoPath])

  if (!file) {
    return (
      <div className="diff-empty">
        <span className="diff-empty-text">Datei in der Liste anklicken um den Diff anzuzeigen</span>
      </div>
    )
  }

  const blameMap = new Map(blame.map((b) => [b.line, b]))

  return (
    <div className="diff-viewer">
      <div className="diff-toolbar">
        <span className="diff-filename truncate" title={file.path}>{file.path.split(/[\\/]/).pop()}</span>
        <span className="diff-path truncate" title={file.path}>{file.path}</span>
        <div style={{ flex: 1 }} />
        {!binary && diff.length > 0 && (
          <button
            className={`btn btn-ghost btn-sm ${showBlame ? 'diff-blame-active' : ''}`}
            onClick={() => setShowBlame(!showBlame)}
            title="Blame: zeigt wer welche Zeile zuletzt geändert hat"
          >
            {showBlame ? <EyeOff size={11} /> : <Eye size={11} />}
            Blame
          </button>
        )}
      </div>

      {loading && <div className="diff-loading">Lade Diff…</div>}

      {!loading && binary && (
        <div className="diff-empty">
          <span className="diff-empty-text">Binärdatei — kein Textdiff möglich</span>
        </div>
      )}

      {!loading && !binary && diff.length === 0 && (
        <div className="diff-empty">
          <span className="diff-empty-text">Keine Änderungen</span>
        </div>
      )}

      {!loading && !binary && diff.length > 0 && (
        <div className="diff-content">
          <table className="diff-table">
            <tbody>
              {diff.map((line, i) => {
                if (line.type === 'meta') return null
                if (line.type === 'hunk') {
                  return (
                    <tr key={i} className="diff-line diff-line--hunk">
                      <td className="diff-line-num" colSpan={2} />
                      {showBlame && <td className="diff-blame-col" />}
                      <td className="diff-line-sign" />
                      <td className="diff-line-content"><code>{line.content}</code></td>
                    </tr>
                  )
                }
                const blameEntry = showBlame && (line.type === 'context' || line.type === 'remove') && line.oldLine !== undefined
                  ? blameMap.get(line.oldLine)
                  : undefined
                return (
                  <tr key={i} className={`diff-line diff-line--${line.type}`}>
                    <td className="diff-line-num diff-line-num--old">
                      {(line.type === 'context' || line.type === 'remove') && line.oldLine !== undefined ? line.oldLine : ''}
                    </td>
                    <td className="diff-line-num diff-line-num--new">
                      {(line.type === 'context' || line.type === 'add') && line.newLine !== undefined ? line.newLine : ''}
                    </td>
                    {showBlame && (
                      <td
                        className="diff-blame-col"
                        title={blameEntry ? `${blameEntry.author} · ${blameEntry.summary}` : ''}
                      >
                        {blameEntry ? <><span className="diff-blame-author">{blameEntry.author.split(' ')[0]}</span><span className="diff-blame-date">{blameEntry.date}</span></> : null}
                      </td>
                    )}
                    <td className="diff-line-sign">
                      {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                    </td>
                    <td className="diff-line-content"><code>{line.content}</code></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
