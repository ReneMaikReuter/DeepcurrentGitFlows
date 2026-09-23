import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  type: ToastType
  text: string
  onClick?: () => void
  persistent?: boolean
}

interface ToastState {
  toasts: Toast[]
  push: (type: ToastType, text: string, onClick?: () => void, persistent?: boolean) => void
  remove: (id: string) => void
}

let _seq = 0

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (type, text, onClick, persistent) => {
    const id = `t${++_seq}`
    set((s) => ({ toasts: [...s.toasts, { id, type, text, onClick, persistent }] }))
    if (!persistent) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      }, 5000)
    }
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  ok: (text: string, onClick?: () => void) => useToastStore.getState().push('success', text, onClick),
  err: (text: string) => useToastStore.getState().push('error', text),
  info: (text: string, persistent?: boolean) => useToastStore.getState().push('info', text, undefined, persistent),
}
