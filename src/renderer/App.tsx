import { useEffect, useState } from 'react'
import { useRepoStore } from './store/repoStore'
import { WelcomeView } from './components/views/WelcomeView'
import { Starfield } from './components/ui/Starfield'
import { MainView } from './components/views/MainView'
import { CompactView } from './components/views/CompactView'
import { TermsModal } from './components/ui/TermsModal'
import { WhatsNewModal } from './components/ui/WhatsNewModal'
import { ipc, IPC } from './hooks/useIpc'
import { useTutorialStore } from './store/tutorialStore'
import type { AppSettings } from '../shared/types'
import './styles/app.css'
import './components/ui/WhatsNewModal.css'

const CURRENT_VERSION = '0.9.3'

export function App() {
  const { currentRepo, loadSavedRepos } = useRepoStore()
  const tutorial = useTutorialStore()
  const [showTerms, setShowTerms] = useState(false)
  const [showWhatsNew, setShowWhatsNew] = useState(false)
  const [ready, setReady] = useState(false)
  const [compactMode, setCompactMode] = useState(() => {
    try { return localStorage.getItem('compactMode') === 'true' } catch { return false }
  })

  const handleStartTutorial = () => {
    const wasCompact = compactMode
    setCompactMode(true)
    localStorage.setItem('compactMode', 'true')
    tutorial.startTutorial(wasCompact)
  }

  useEffect(() => {
    const handleTutorialExit = (e: Event) => {
      const { wasCompact } = (e as CustomEvent).detail
      setCompactMode(wasCompact)
      localStorage.setItem('compactMode', String(wasCompact))
    }
    window.addEventListener('tutorial:exit', handleTutorialExit)
    return () => window.removeEventListener('tutorial:exit', handleTutorialExit)
  }, [])

  useEffect(() => {
    loadSavedRepos()

    ipc.invoke<AppSettings>(IPC.SETTINGS_GET).then((s) => {
      if (!s) { setReady(true); return }

      // Apply saved theme + font size immediately on startup
      if (s.theme) {
        document.documentElement.setAttribute('data-theme', s.theme)
        if (s.theme === 'glass') {
          ;(window as any).deepcurrent?.invoke('window:apply-startup-material')
        }
      }
      if (s.fontSize) {
        const zoom = s.fontSize === 'small' ? '0.88' : s.fontSize === 'large' ? '1.14' : '1'
        const root = document.getElementById('root') as HTMLElement | null
        if (root) root.style.zoom = zoom
      }

      if (!s.termsAccepted) {
        setShowTerms(true)
        setReady(true)
        return
      }

      if (s.lastSeenVersion !== CURRENT_VERSION) {
        setShowWhatsNew(true)
        ipc.invoke(IPC.SETTINGS_SET, { lastSeenVersion: CURRENT_VERSION })
      }

      setReady(true)
    })
  }, [])

  const handleAcceptTerms = () => {
    ipc.invoke(IPC.SETTINGS_SET, { termsAccepted: true, lastSeenVersion: CURRENT_VERSION })
    setShowTerms(false)
    setShowWhatsNew(true)
  }

  const handleDeclineTerms = () => {
    ;(window as any).deepcurrent?.invoke('window:close')
  }

  if (!ready) return null

  return (
    <div className="app-root">
      <Starfield />
      {showTerms && (
        <TermsModal onAccept={handleAcceptTerms} onDecline={handleDeclineTerms} />
      )}
      {!showTerms && showWhatsNew && (
        <WhatsNewModal version={CURRENT_VERSION} onClose={() => setShowWhatsNew(false)} />
      )}
      {(currentRepo || tutorial.active) ? (
        <>
          <div style={{ display: compactMode ? 'contents' : 'none' }}>
            <CompactView active={compactMode} onSwitchToPro={() => { setCompactMode(false); localStorage.setItem('compactMode', 'false') }} />
          </div>
          <div style={{ display: compactMode ? 'none' : 'contents' }}>
            <MainView active={!compactMode} onSwitchToCompact={() => { setCompactMode(true); localStorage.setItem('compactMode', 'true') }} />
          </div>
        </>
      ) : <WelcomeView onStartTutorial={handleStartTutorial} />}
    </div>
  )
}
