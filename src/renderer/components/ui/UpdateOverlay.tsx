import { useEffect, useRef, useState } from 'react'
import './UpdateOverlay.css'

interface Props {
  version: string
  downloadProgress: number | null
  onInstall: () => void
}

type Phase = 'downloading' | 'installing'

export function UpdateOverlay({ version, downloadProgress, onInstall }: Props) {
  const [phase, setPhase] = useState<Phase>('downloading')
  const [countdown, setCountdown] = useState(5)
  const [simulatedPct, setSimulatedPct] = useState(2)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const simRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Simulate download progress (electron-updater often doesn't emit on Windows)
  useEffect(() => {
    simRef.current = setInterval(() => {
      setSimulatedPct((p) => {
        if (p >= 90) { clearInterval(simRef.current!); return 90 }
        return p + Math.random() * 3
      })
    }, 600)
    return () => { if (simRef.current) clearInterval(simRef.current) }
  }, [])

  // Real progress jumps ahead of simulated
  useEffect(() => {
    if (downloadProgress != null && downloadProgress > 0) {
      setSimulatedPct((p) => Math.max(p, downloadProgress))
    }
    if (downloadProgress === 100) {
      if (simRef.current) clearInterval(simRef.current)
      setSimulatedPct(100)
      setTimeout(() => setPhase('installing'), 400)
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
      {/* Top progress bar */}
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

        {/* Phase indicator */}
        <div className="update-overlay-phases">
          <div className={`update-overlay-phase ${phase === 'downloading' ? 'active' : 'done'}`}>
            <span className="update-overlay-phase-dot" />
            Download
          </div>
          <div className="update-overlay-phase-line" />
          <div className={`update-overlay-phase ${phase === 'installing' ? 'active' : phase === 'downloading' ? 'pending' : 'done'}`}>
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
      </div>
    </div>
  )
}
