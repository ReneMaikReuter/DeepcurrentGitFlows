import { useEffect, useRef, useState } from 'react'
import './UpdateOverlay.css'

interface Props {
  version: string
  downloadProgress: number | null
  onInstall: () => void
}

export function UpdateOverlay({ version, downloadProgress, onInstall }: Props) {
  const [countdown, setCountdown] = useState(10)
  const [ready, setReady] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (downloadProgress !== null && downloadProgress < 100) return
    if (!ready && downloadProgress === 100) {
      setReady(true)
    }
  }, [downloadProgress])

  useEffect(() => {
    if (!ready) return
    intervalRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(intervalRef.current!)
          onInstall()
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [ready])

  const pct = downloadProgress ?? 0

  return (
    <div className="update-overlay">
      <div className="update-overlay-progress-track">
        <div className="update-overlay-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="update-overlay-box">
        <div className="update-overlay-icon">⬇</div>
        <div className="update-overlay-title">Update verfügbar</div>
        <div className="update-overlay-version">Version {version}</div>

        {!ready && (
          <>
            <div className="update-overlay-label">Wird heruntergeladen…</div>
            <div className="update-overlay-pct">{pct}%</div>
          </>
        )}

        {ready && (
          <>
            <div className="update-overlay-label">
              Wird in <strong>{countdown}</strong> Sekunden installiert und neu gestartet…
            </div>
            <button className="btn btn-primary" onClick={onInstall}>
              Jetzt installieren
            </button>
          </>
        )}
      </div>
    </div>
  )
}
