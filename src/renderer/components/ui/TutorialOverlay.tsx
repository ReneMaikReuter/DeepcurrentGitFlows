import { useEffect, useRef, useState, useCallback } from 'react'
import { ChevronRight, ChevronLeft, X } from 'lucide-react'
import { useTutorialStore } from '../../store/tutorialStore'
import { TUTORIAL_STEPS } from './tutorialSteps'
import './TutorialOverlay.css'

interface Rect { top: number; left: number; width: number; height: number }

const PAD = 8

function getRect(tid: string): Rect | null {
  const el = document.querySelector(`[data-tid="${tid}"]`) as HTMLElement | null
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function TutorialOverlay() {
  const { step, totalSteps, nextStep, prevStep, exit } = useTutorialStore()
  const current = TUTORIAL_STEPS[step]
  const [targetRect, setTargetRect] = useState<Rect | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})

  const updateLayout = useCallback(() => {
    if (!current.targetId) {
      setTargetRect(null)
      setPanelStyle({
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: 420,
      })
      return
    }

    const rect = getRect(current.targetId)
    setTargetRect(rect)

    if (!rect) {
      setPanelStyle({
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: 420,
      })
      return
    }

    const panelW = 340
    const panelH = panelRef.current?.offsetHeight ?? 180
    const vw = window.innerWidth
    const vh = window.innerHeight
    const pos = current.position

    let top = 0
    let left = 0

    if (pos === 'bottom') {
      top = rect.top + rect.height + PAD + 8
      left = rect.left + rect.width / 2 - panelW / 2
    } else if (pos === 'top') {
      top = rect.top - panelH - PAD - 8
      left = rect.left + rect.width / 2 - panelW / 2
    } else if (pos === 'right') {
      top = rect.top + rect.height / 2 - panelH / 2
      left = rect.left + rect.width + PAD + 8
    } else if (pos === 'left') {
      top = rect.top + rect.height / 2 - panelH / 2
      left = rect.left - panelW - PAD - 8
    }

    // Clamp to viewport
    left = clamp(left, 12, vw - panelW - 12)
    top = clamp(top, 12, vh - panelH - 12)

    setPanelStyle({ top, left, width: panelW })
  }, [current, step])

  useEffect(() => {
    updateLayout()
    const ro = new ResizeObserver(updateLayout)
    ro.observe(document.documentElement)
    window.addEventListener('resize', updateLayout)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateLayout)
    }
  }, [updateLayout])

  const handleExit = () => {
    exit((wasCompact) => {
      // Dispatch custom event — App.tsx listens for it
      window.dispatchEvent(new CustomEvent('tutorial:exit', { detail: { wasCompact } }))
    })
  }

  const isFirst = step === 0
  const isLast = step === totalSteps - 1

  return (
    <div className="tutorial-overlay">
      {/* Spotlight mask — 4 rectangles around target */}
      {targetRect ? (
        <>
          <div className="tutorial-mask" style={{ top: 0, left: 0, right: 0, height: Math.max(0, targetRect.top - PAD) }} />
          <div className="tutorial-mask" style={{ top: targetRect.top + targetRect.height + PAD, left: 0, right: 0, bottom: 0 }} />
          <div className="tutorial-mask" style={{ top: targetRect.top - PAD, left: 0, width: Math.max(0, targetRect.left - PAD), height: targetRect.height + PAD * 2 }} />
          <div className="tutorial-mask" style={{ top: targetRect.top - PAD, left: targetRect.left + targetRect.width + PAD, right: 0, height: targetRect.height + PAD * 2 }} />
          <div
            className="tutorial-spotlight-ring"
            style={{
              top: targetRect.top - PAD,
              left: targetRect.left - PAD,
              width: targetRect.width + PAD * 2,
              height: targetRect.height + PAD * 2,
            }}
          />
        </>
      ) : (
        <div className="tutorial-mask tutorial-mask--full" />
      )}

      {/* Step panel */}
      <div className="tutorial-panel" style={panelStyle} ref={panelRef}>
        <div className="tutorial-panel-header">
          <span className="tutorial-step-counter">{step + 1} / {totalSteps}</span>
          <button className="tutorial-close-btn" onClick={handleExit} title="Tutorial beenden">
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        <div className="tutorial-progress-bar">
          <div className="tutorial-progress-fill" style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
        </div>

        <h3 className="tutorial-title">{current.title}</h3>
        <p className="tutorial-description">{current.description}</p>

        <div className="tutorial-nav">
          <button
            className="btn btn-ghost btn-sm tutorial-nav-btn"
            onClick={prevStep}
            disabled={isFirst}
          >
            <ChevronLeft size={13} strokeWidth={2} />
            Zurück
          </button>
          <button
            className="btn btn-ghost btn-sm tutorial-skip-btn"
            onClick={handleExit}
          >
            Beenden
          </button>
          <button
            className="btn btn-primary btn-sm tutorial-nav-btn"
            onClick={isLast ? handleExit : nextStep}
          >
            {isLast ? 'Fertig' : 'Weiter'}
            {!isLast && <ChevronRight size={13} strokeWidth={2} />}
          </button>
        </div>
      </div>
    </div>
  )
}
