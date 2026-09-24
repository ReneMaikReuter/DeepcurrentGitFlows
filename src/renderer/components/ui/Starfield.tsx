import { useEffect, useRef } from 'react'
import './Starfield.css'

interface Star {
  x: number
  y: number
  r: number
  baseOpacity: number
  twinkleSpeed: number
  twinklePhase: number
  color: string
}

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const starsRef = useRef<Star[]>([])
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const STAR_COLORS = [
      'rgba(255,255,255,ALPHA)',
      'rgba(200,210,255,ALPHA)',
      'rgba(255,240,200,ALPHA)',
      'rgba(255,210,180,ALPHA)',
      'rgba(180,200,255,ALPHA)',
    ]

    const init = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight

      starsRef.current = Array.from({ length: 620 }, () => {
        const rand = Math.random()
        const r = rand < 0.7 ? Math.random() * 0.7 + 0.2
                : rand < 0.92 ? Math.random() * 0.8 + 0.8
                : Math.random() * 1.0 + 1.5
        return {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r,
          baseOpacity: Math.random() * 0.55 + 0.25,
          twinkleSpeed: Math.random() * 0.018 + 0.003,
          twinklePhase: Math.random() * Math.PI * 2,
          color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
        }
      })
    }

    let t = 0
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      t += 0.016

      for (const star of starsRef.current) {
        const twinkle = 0.75 + 0.25 * Math.sin(t * star.twinkleSpeed * 60 + star.twinklePhase)
        const alpha = Math.min(1, star.baseOpacity * twinkle)
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2)
        ctx.fillStyle = star.color.replace('ALPHA', String(alpha.toFixed(3)))
        ctx.fill()

        // subtle glow on bigger stars
        if (star.r > 1.4) {
          ctx.beginPath()
          ctx.arc(star.x, star.y, star.r * 2.5, 0, Math.PI * 2)
          ctx.fillStyle = star.color.replace('ALPHA', String((alpha * 0.12).toFixed(3)))
          ctx.fill()
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    // Debounce resize so FancyZones/Snap rapid resize events don't flood
    let resizeTimer: ReturnType<typeof setTimeout>
    const onResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(init, 80)
    }

    init()
    draw()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      clearTimeout(resizeTimer)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return <canvas ref={canvasRef} className="starfield-canvas" />
}
