import { IPC } from '../../shared/types'
import type { IpcChannel } from '../../shared/types'

// Window type augmentation — the preload bridge is exposed here
declare global {
  interface Window {
    deepcurrent: {
      invoke: (channel: IpcChannel, ...args: unknown[]) => Promise<unknown>
      on: (channel: IpcChannel, listener: (...args: unknown[]) => void) => () => void
      off: (channel: IpcChannel, listener: (...args: unknown[]) => void) => void
    }
  }
}

export const ipc = {
  invoke<T>(channel: IpcChannel, ...args: unknown[]): Promise<T> {
    return window.deepcurrent.invoke(channel, ...args) as Promise<T>
  },
  on(channel: IpcChannel, listener: (...args: unknown[]) => void): () => void {
    return window.deepcurrent.on(channel, listener)
  },
}

export { IPC }
