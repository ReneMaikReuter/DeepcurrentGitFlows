import { useState, useEffect } from 'react'
import './WindowControls.css'

export function WindowControls() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    const invoke = (window as any).deepcurrent?.invoke
    if (!invoke) return
    invoke('window:is-maximized').then((v: boolean) => setMaximized(v)).catch(() => {})
  }, [])

  const invoke = (channel: string) => {
    const fn = (window as any).deepcurrent?.invoke
    if (!fn) return
    fn(channel).then(() => {
      if (channel === 'window:maximize') {
        fn('window:is-maximized').then((v: boolean) => setMaximized(v)).catch(() => {})
      }
    }).catch(() => {})
  }

  return (
    <div className="window-controls">
      <button className="wc-btn wc-minimize" title="Minimieren" onClick={() => invoke('window:minimize')}>
        <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor"/></svg>
      </button>
      <button className="wc-btn wc-maximize" title={maximized ? 'Wiederherstellen' : 'Maximieren'} onClick={() => invoke('window:maximize')}>
        {maximized ? (
          <svg width="11" height="11" viewBox="0 0 11 11">
            <rect x="3" y="0" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <rect x="0" y="3" width="8" height="8" fill="var(--bg-surface)" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 11 11">
            <rect x="0.75" y="0.75" width="9.5" height="9.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
      <button className="wc-btn wc-close" title="Schließen" onClick={() => invoke('window:close')}>
        <svg width="10" height="10" viewBox="0 0 10 10">
          <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2"/>
          <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2"/>
        </svg>
      </button>
    </div>
  )
}
