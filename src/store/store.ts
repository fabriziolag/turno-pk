import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DayCode, DayPlan, DB, Family, School } from '../lib/types'
import { seedDB } from './seed'

const EMPTY_WEEK = () => ({ blocked: false, label: '', days: {} })

interface StoreState {
  db: DB

  // Familias
  addFamily: (f: Family) => void
  updateFamily: (f: Family) => void
  removeFamily: (id: string) => void

  // Turnos (grilla semanal)
  setDay: (wk: string, dc: DayCode, plan: DayPlan) => void
  setWeekBlocked: (wk: string, blocked: boolean, label?: string) => void

  // Confirmación diaria
  setKidStatus: (dk: string, kidId: string, status: 'go' | 'stay') => void
  setConfirmDriver: (
    dk: string,
    famId: string | null,
    parentIdx: number,
    fallbackDriver: string | null,
  ) => void

  // Ruta
  markDelivered: (dk: string, famId: string) => void
  setManualOrder: (order: string[] | null) => void

  // Ajustes
  setSchool: (s: School) => void
  setExitTime: (dc: DayCode, value: string) => void

  // Datos
  importDB: (db: DB) => void
  resetDB: () => void
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      db: seedDB(),

      addFamily: (f) => set((s) => ({ db: { ...s.db, families: [...s.db.families, f] } })),
      updateFamily: (f) =>
        set((s) => ({
          db: { ...s.db, families: s.db.families.map((x) => (x.id === f.id ? f : x)) },
        })),
      removeFamily: (id) =>
        set((s) => ({ db: { ...s.db, families: s.db.families.filter((x) => x.id !== id) } })),

      setDay: (wk, dc, plan) =>
        set((s) => {
          const schedule = { ...s.db.schedule }
          const week = { ...(schedule[wk] ?? EMPTY_WEEK()) }
          week.days = { ...week.days, [dc]: plan }
          schedule[wk] = week
          return { db: { ...s.db, schedule } }
        }),
      setWeekBlocked: (wk, blocked, label = '') =>
        set((s) => {
          const schedule = { ...s.db.schedule }
          const week = { ...(schedule[wk] ?? EMPTY_WEEK()) }
          week.blocked = blocked
          week.label = blocked ? label || 'Sin turnos' : ''
          schedule[wk] = week
          return { db: { ...s.db, schedule } }
        }),

      setKidStatus: (dk, kidId, status) =>
        set((s) => {
          const confirm = { ...s.db.confirm }
          const c = confirm[dk]
            ? { ...confirm[dk], kids: { ...confirm[dk].kids } }
            : { kids: {}, picked: {}, driver: null, driverParent: 0 }
          c.kids[kidId] = status
          confirm[dk] = c
          return { db: { ...s.db, confirm } }
        }),
      setConfirmDriver: (dk, famId, parentIdx, fallbackDriver) =>
        set((s) => {
          const confirm = { ...s.db.confirm }
          const c = confirm[dk]
            ? { ...confirm[dk] }
            : { kids: {}, picked: {}, driver: fallbackDriver, driverParent: 0 }
          c.driver = famId
          c.driverParent = parentIdx
          confirm[dk] = c
          return { db: { ...s.db, confirm } }
        }),

      markDelivered: (dk, famId) =>
        set((s) => {
          const routeState = { ...s.db.routeState }
          const rs = routeState[dk]
            ? { ...routeState[dk], done: { ...routeState[dk].done } }
            : { done: {} as Record<string, boolean> }
          rs.done[famId] = true
          routeState[dk] = rs
          return { db: { ...s.db, routeState } }
        }),
      setManualOrder: (order) => set((s) => ({ db: { ...s.db, manualOrder: order } })),

      setSchool: (school) => set((s) => ({ db: { ...s.db, school } })),
      setExitTime: (dc, value) =>
        set((s) => ({ db: { ...s.db, exitTimes: { ...s.db.exitTimes, [dc]: value } } })),

      importDB: (db) => set({ db }),
      resetDB: () => set({ db: seedDB() }),
    }),
    {
      name: 'turnopk_v1',
      partialize: (s) => ({ db: s.db }),
    },
  ),
)
