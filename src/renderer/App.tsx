import { useEffect } from 'react'
import { useRepoStore } from './store/repoStore'
import { WelcomeView } from './components/views/WelcomeView'
import { MainView } from './components/views/MainView'
import './styles/app.css'

export function App() {
  const { currentRepo, loadSavedRepos } = useRepoStore()

  useEffect(() => {
    loadSavedRepos()
  }, [loadSavedRepos])

  return (
    <div className="app-root">
      {currentRepo ? <MainView /> : <WelcomeView />}
    </div>
  )
}
