import { useEffect, useRef, useState } from 'react'

const PARTY_AUDIO_URL = 'https://my.hidrive.com/api/sharelink/download?id=DSOP0VOYz'

export function PartyButton() {
  const [active, setActive] = useState(false)
  const audioRef    = useRef<HTMLAudioElement | null>(null)
  const ctxRef      = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef      = useRef<number>(0)

  useEffect(() => {
    audioRef.current = new Audio(PARTY_AUDIO_URL)
    audioRef.current.crossOrigin = 'anonymous'
    audioRef.current.loop = true
    audioRef.current.volume = 0.7
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement

    if (active) {
      root.setAttribute('data-party', 'true')

      // Audio-Kontext + Analyser beim ersten Start aufbauen
      if (!ctxRef.current && audioRef.current) {
        const ctx      = new AudioContext()
        const analyser = ctx.createAnalyser()
        analyser.fftSize          = 256
        analyser.smoothingTimeConstant = 0.8

        const src = ctx.createMediaElementSource(audioRef.current)
        src.connect(analyser)
        analyser.connect(ctx.destination)

        ctxRef.current      = ctx
        analyserRef.current = analyser
      }

      ctxRef.current?.resume()
      audioRef.current?.play().catch(() => {})

      // Bass-Analyse Loop
      const data = new Uint8Array(analyserRef.current?.frequencyBinCount ?? 128)

      const tick = () => {
        analyserRef.current?.getByteFrequencyData(data)

        // Bins 0-8 entsprechen ~0-175 Hz bei fftSize=256, 44.1kHz
        let bassSum = 0
        const bassEnd = 9
        for (let i = 0; i < bassEnd; i++) bassSum += data[i]
        const bass = bassSum / (bassEnd * 255) // 0..1

        // CSS-Variable für Sun-Scale und Grid-Opacity
        const sunScale  = 1 + bass * 0.22        // 1.0 – 1.22
        const gridAlpha = 0.45 + bass * 0.45     // 0.45 – 0.90
        const glowSize  = Math.round(50 + bass * 80) // 50 – 130px

        root.style.setProperty('--party-sun-scale', String(sunScale))
        root.style.setProperty('--party-grid-alpha', String(gridAlpha))
        root.style.setProperty('--party-glow', `${glowSize}px`)

        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)

    } else {
      root.removeAttribute('data-party')
      root.style.removeProperty('--party-sun-scale')
      root.style.removeProperty('--party-grid-alpha')
      root.style.removeProperty('--party-glow')
      cancelAnimationFrame(rafRef.current)
      ctxRef.current?.suspend()
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
    }

    return () => {
      root.removeAttribute('data-party')
      root.style.removeProperty('--party-sun-scale')
      root.style.removeProperty('--party-grid-alpha')
      root.style.removeProperty('--party-glow')
      cancelAnimationFrame(rafRef.current)
    }
  }, [active])

  return (
    <button
      className={`party-btn ${active ? 'party-btn--active' : ''}`}
      onClick={() => setActive(v => !v)}
      title={active ? 'Party stoppen' : 'Party starten'}
    >
      {active ? '🕹️' : '🪩'}
    </button>
  )
}
