import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'
import type { IpcChannel } from '../shared/types'

// The preload script is the ONLY bridge between the renderer and the main process.
// It exposes a minimal, typed API — the renderer cannot call arbitrary Node APIs.
// Allowed IPC channels the renderer may invoke
const ALLOWED_INVOKE_CHANNELS = new Set<string>(Object.values(IPC))
ALLOWED_INVOKE_CHANNELS.add('dialog:open-directory')
ALLOWED_INVOKE_CHANNELS.add('window:minimize')
ALLOWED_INVOKE_CHANNELS.add('window:maximize')
ALLOWED_INVOKE_CHANNELS.add('window:close')
ALLOWED_INVOKE_CHANNELS.add('window:is-maximized')

contextBridge.exposeInMainWorld('deepcurrent', {
  invoke: (channel: IpcChannel | 'dialog:open-directory', ...args: unknown[]) => {
    if (!ALLOWED_INVOKE_CHANNELS.has(channel)) {
      throw new Error(`IPC channel not allowed: ${channel}`)
    }
    return ipcRenderer.invoke(channel, ...args)
  },
  on: (channel: IpcChannel, listener: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => listener(...args))
    return () => ipcRenderer.removeListener(channel, listener as any)
  },
  off: (channel: IpcChannel, listener: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, listener as any)
  },
})

// Type declaration for the renderer
declare global {
  interface Window {
    deepcurrent: {
      invoke: (channel: IpcChannel, ...args: unknown[]) => Promise<unknown>
      on: (channel: IpcChannel, listener: (...args: unknown[]) => void) => () => void
      off: (channel: IpcChannel, listener: (...args: unknown[]) => void) => void
    }
  }
}
