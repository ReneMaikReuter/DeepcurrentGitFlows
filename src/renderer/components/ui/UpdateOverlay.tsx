import { useEffect, useRef, useState } from 'react'
import './UpdateOverlay.css'

interface Props {
  version: string
  downloadProgress: number | null
  updateDownloaded: boolean
  onInstall: () => void
  onDismiss: () => void
}

type Phase = 'downloading' | 'installing'

export function UpdateOverlay({ version, downloadProgress, updateDownloaded, onInstall, onDismiss }: Props) {
  const [phase, setPhase] = useState<Phase>('downloading')
  const [countdown, setCountdown] = useState(5)
  const [simulatedPct, setSimulatedPct] = useState(2)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const simRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const switchToInstalling = () => {
    if (simRef.current) clearInterval(simRef.current)
    setSimulatedPct(100)
    setPhase('installing')
  }

  // Simulate download progress — fast early, slows near 99
  useEffect(() => {
    simRef.current = setInterval(() => {
      setSimulatedPct((p) => {
        if (p >= 99) return 99
        const step = p < 60 ? Math.random() * 3 : p < 85 ? Math.random() * 1.2 : Math.random() * 0.15
        return Math.min(99, p + step)
      })
    }, 600)
    return () => { if (simRef.current) clearInterval(simRef.current) }
  }, [])

  // Switch to install phase only when download is confirmed done
  useEffect(() => {
    if (updateDownloaded && phase === 'downloading') switchToInstalling()
  }, [updateDownloaded])

  // Real progress event as visual hint
  useEffect(() => {
    if (downloadProgress != null && downloadProgress > 0) {
      setSimulatedPct((p) => Math.max(p, downloadProgress))
    }
  }, [downloadProgress])

  // Countdown for auto-install
  useEffect(() => {
    if (phase !== 'installing') return
    intervalRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(intervalRef.current!); onInstall(); return 0 }
        return c - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [phase])

  const displayPct = Math.min(100, Math.round(simulatedPct))

  return (
    <div className="update-overlay">
      <div className="update-overlay-progress-track">
        <div
          className="update-overlay-progress-fill"
          style={{ width: phase === 'installing' ? '100%' : `${displayPct}%`, transition: 'width 0.5s ease' }}
        />
      </div>

      <div className="update-overlay-box">
        <div className="update-overlay-icon update-overlay-icon--animated">⬇</div>
        <div className="update-overlay-title">Update verfügbar</div>
        <div className="update-overlay-version">Version {version}</div>

        <div className="update-overlay-phases">
          <div className={`update-overlay-phase ${phase === 'downloading' ? 'active' : 'done'}`}>
            <span className="update-overlay-phase-dot" />
            Download
          </div>
          <div className="update-overlay-phase-line" />
          <div className={`update-overlay-phase ${phase === 'installing' ? 'active' : 'pending'}`}>
            <span className="update-overlay-phase-dot" />
            Installation
          </div>
        </div>

        {phase === 'downloading' && (
          <>
            <div className="update-overlay-label">Wird heruntergeladen…</div>
            <div className="update-overlay-pct">{displayPct}%</div>
          </>
        )}

        {phase === 'installing' && (
          <>
            <div className="update-overlay-label">
              Neustart in <strong>{countdown}</strong> Sekunden…
            </div>
            <button className="btn btn-primary" onClick={onInstall}>
              Jetzt neu starten
            </button>
          </>
        )}

        <button className="update-overlay-dismiss" onClick={onDismiss} title="Abbrechen — später installieren">
          Abbrechen
        </button>
      </div>
    </div>
  )
}
