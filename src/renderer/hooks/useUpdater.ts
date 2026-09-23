import { useEffect, useState } from 'react'

export interface UpdaterState {
  updateAvailable: boolean
  updateDownloaded: boolean
  version: string | null
  downloadProgress: number | null
  error: string | null
  noUpdate: boolean
  dismissed: boolean
}

export function useUpdater() {
  const [state, setState] = useState<UpdaterState>({
    updateAvailable: false,
    updateDownloaded: false,
    version: null,
    downloadProgress: null,
    error: null,
    noUpdate: false,
    dismissed: false,
  })

  useEffect(() => {
    const dc = (window as any).deepcurrent
    if (!dc?.on) return

    const applyState = (s: any) => {
      if (!s) return
      if (s.updateDownloaded) {
        setState((prev) => ({ ...prev, updateAvailable: true, updateDownloaded: true, downloadProgress: 100, version: s.version }))
      } else if (s.updateAvailable) {
        setState((prev) => ({ ...prev, updateAvailable: true, version: s.version, downloadProgress: s.downloadProgress }))
      }
    }

    // Initial query
    dc.invoke('updater:get-state').then(applyState).catch(() => {})

    // Poll every 2s — electron-updater on Windows often doesn't fire events reliably
    const poll = setInterval(() => {
      dc.invoke('updater:get-state').then(applyState).catch(() => {})
    }, 2000)

    const offAvailable = dc.on('updater:update-available', (version: string) => {
      setState((s) => ({ ...s, updateAvailable: true, version, noUpdate: false, error: null }))
    })
    const offProgress = dc.on('updater:download-progress', (pct: number) => {
      setState((s) => ({ ...s, downloadProgress: pct }))
    })
    const offDownloaded = dc.on('updater:update-downloaded', (version: string) => {
      setState((s) => ({ ...s, updateDownloaded: true, downloadProgress: 100, version }))
    })
    const offNoUpdate = dc.on('updater:no-update', () => {
      setState((s) => ({ ...s, noUpdate: true }))
      setTimeout(() => setState((s) => ({ ...s, noUpdate: false })), 3000)
    })
    const offError = dc.on('updater:error', (msg: string) => {
      setState((s) => ({ ...s, error: msg }))
    })

    return () => {
      clearInterval(poll)
      offAvailable?.()
      offProgress?.()
      offDownloaded?.()
      offNoUpdate?.()
      offError?.()
    }
  }, [])

  const checkForUpdates = () => {
    setState((s) => ({ ...s, noUpdate: false, error: null, dismissed: false }))
    ;(window as any).deepcurrent?.invoke('updater:check')
  }

  const installNow = () => {
    ;(window as any).deepcurrent?.send('updater:install-now')
  }

  const dismiss = () => {
    setState((s) => ({ ...s, dismissed: true }))
  }

  return { state, checkForUpdates, installNow, dismiss }
}
