import { useEffect, useState } from 'react'
import { useRepoStore } from './store/repoStore'
import { WelcomeView } from './components/views/WelcomeView'
import { MainView } from './components/views/MainView'
import { CompactView } from './components/views/CompactView'
import { TermsModal } from './components/ui/TermsModal'
import { WhatsNewModal } from './components/ui/WhatsNewModal'
import { ipc, IPC } from './hooks/useIpc'
import type { AppSettings } from '../shared/types'
import './styles/app.css'
import './components/ui/WhatsNewModal.css'

const CURRENT_VERSION = '0.2.6'

export function App() {
  const { currentRepo, loadSavedRepos } = useRepoStore()
  const [showTerms, setShowTerms] = useState(false)
  const [showWhatsNew, setShowWhatsNew] = useState(false)
  const [ready, setReady] = useState(false)
  const [compactMode, setCompactMode] = useState(() => {
    try { return localStorage.getItem('compactMode') === 'true' } catch { return false }
  })

  useEffect(() => {
    loadSavedRepos()

    ipc.invoke<AppSettings>(IPC.SETTINGS_GET).then((s) => {
      if (!s) { setReady(true); return }

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
      {showTerms && (
        <TermsModal onAccept={handleAcceptTerms} onDecline={handleDeclineTerms} />
      )}
      {!showTerms && showWhatsNew && (
        <WhatsNewModal version={CURRENT_VERSION} onClose={() => setShowWhatsNew(false)} />
      )}
      {currentRepo ? (
        <>
          <div style={{ display: compactMode ? 'contents' : 'none' }}>
            <CompactView onSwitchToPro={() => { setCompactMode(false); localStorage.setItem('compactMode', 'false') }} />
          </div>
          <div style={{ display: compactMode ? 'none' : 'contents' }}>
            <MainView onSwitchToCompact={() => { setCompactMode(true); localStorage.setItem('compactMode', 'true') }} />
          </div>
        </>
      ) : <WelcomeView />}
    </div>
  )
}
