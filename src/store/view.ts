import { create } from 'zustand'

export type ViewId = 'hoy' | 'ruta' | 'turnos' | 'familias' | 'ajustes'

interface ViewState {
  view: ViewId
  setView: (v: ViewId) => void
  /** Fecha seleccionada, compartida entre Hoy y Ruta. */
  hoyAnchor: Date
  setHoyAnchor: (d: Date) => void
}

export const useView = create<ViewState>((set) => ({
  view: 'hoy',
  setView: (view) => set({ view }),
  hoyAnchor: new Date(),
  setHoyAnchor: (hoyAnchor) => set({ hoyAnchor }),
}))
