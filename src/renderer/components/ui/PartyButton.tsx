import { useEffect, useRef, useState } from 'react'

const PARTY_AUDIO_URL = 'https://my.hidrive.com/api/sharelink/download?id=DSOP0VOYz'

export function PartyButton() {
  const [active, setActive] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    audioRef.current = new Audio(PARTY_AUDIO_URL)
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
      audioRef.current?.play().catch(() => {})
    } else {
      root.removeAttribute('data-party')
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
    }
    return () => root.removeAttribute('data-party')
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
