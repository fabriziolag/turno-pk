import { create } from 'zustand'

export type ToastType = '' | 'ok' | 'warn'

interface ToastState {
  msg: string
  type: ToastType
  visible: boolean
  toast: (msg: string, type?: ToastType) => void
}

let timer: ReturnType<typeof setTimeout> | undefined

export const useToast = create<ToastState>((set) => ({
  msg: '',
  type: '',
  visible: false,
  toast: (msg, type = '') => {
    set({ msg, type, visible: true })
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => set((s) => ({ ...s, visible: false })), 2800)
  },
}))
