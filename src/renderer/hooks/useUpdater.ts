import { useEffect, useState } from 'react'

export interface UpdaterState {
  updateAvailable: boolean
  updateDownloaded: boolean
  version: string | null
  downloadProgress: number | null
  error: string | null
  noUpdate: boolean
}

export function useUpdater() {
  const [state, setState] = useState<UpdaterState>({
    updateAvailable: false,
    updateDownloaded: false,
    version: null,
    downloadProgress: null,
    error: null,
    noUpdate: false,
  })

  useEffect(() => {
    const dc = (window as any).deepcurrent
    if (!dc?.on) return

    // Query persisted state first — catches events that fired before React mounted
    dc.invoke('updater:get-state').then((s: any) => {
      if (!s) return
      if (s.updateDownloaded) {
        setState((prev) => ({ ...prev, updateAvailable: true, updateDownloaded: true, downloadProgress: 100, version: s.version }))
      } else if (s.updateAvailable) {
        setState((prev) => ({ ...prev, updateAvailable: true, version: s.version, downloadProgress: s.downloadProgress }))
      }
    }).catch(() => {})

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
      offAvailable?.()
      offProgress?.()
      offDownloaded?.()
      offNoUpdate?.()
      offError?.()
    }
  }, [])

  const checkForUpdates = () => {
    setState((s) => ({ ...s, noUpdate: false, error: null }))
    ;(window as any).deepcurrent?.invoke('updater:check')
  }

  const installNow = () => {
    ;(window as any).deepcurrent?.send('updater:install-now')
  }

  return { state, checkForUpdates, installNow }
}
