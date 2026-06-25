// Documento operativo de UN turno (tabla turno_docs, key = turno_id).
// Guarda planificación semanal, confirmación diaria y estado de ruta.
// Referencia ids: kids = ids de hijo, driver/paradas = ids de familia.
import { supabase } from './supabase'
import type { DayCode } from './types'

export interface TDDayPlan {
  kids: string[] // ids de hijo que van
  driver: string | null // id de familia que conduce
}
export interface TDWeek {
  blocked: boolean
  label: string
  days: Partial<Record<DayCode, TDDayPlan>>
}
export interface TDConfirm {
  kids: Record<string, 'go' | 'stay'> // kidId -> estado
  driver: string | null // familyId
  driverParent: string | null // profileId del que retira
}
export interface TDRoute {
  order?: string[] // ids de familia
  done: Record<string, boolean> // familyId -> entregado
}
export interface TurnoDoc {
  schedule: Record<string, TDWeek> // weekKey -> semana
  confirm: Record<string, TDConfirm> // dateKey -> confirmación
  routeState: Record<string, TDRoute> // dateKey -> ruta
  manualOrder: string[] | null
}

export function emptyDoc(): TurnoDoc {
  return { schedule: {}, confirm: {}, routeState: {}, manualOrder: null }
}

export async function loadTurnoDoc(turnoId: string): Promise<TurnoDoc> {
  if (!supabase) return emptyDoc()
  const { data } = await supabase.from('turno_docs').select('data').eq('turno_id', turnoId).maybeSingle()
  return { ...emptyDoc(), ...((data?.data as Partial<TurnoDoc>) ?? {}) }
}

export async function saveTurnoDoc(turnoId: string, doc: TurnoDoc): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('turno_docs')
    .upsert({ turno_id: turnoId, data: doc, updated_at: new Date().toISOString() })
  if (error) throw error
}
