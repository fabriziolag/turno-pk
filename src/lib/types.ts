// Modelo de dominio de Turno PK — espejo del estado `DB` del demo HTML.

export type DayCode = 'lun' | 'mar' | 'mie' | 'jue' | 'vie'

export interface Parent {
  name: string
  role: string
  phone: string
  email: string
  photo: string
}

export interface Address {
  label: string
  text: string
  region: string
  comuna: string
  extra: string
  housePhoto: string
  lat: number | null
  lng: number | null
}

export interface Contact {
  name: string
  relation: string
  phone: string
  isDefault: boolean
}

export interface Family {
  id: string
  kidName: string
  kidPhoto: string
  famName: string
  parents: Parent[]
  addresses: Address[]
  contacts: Contact[]
}

/** Plan de un día: qué niños van y qué familia conduce. */
export interface DayPlan {
  kids: string[] // ids de familia
  driver: string | null // id de familia
}

/** Plan de una semana (lun–vie), o bloqueada (vacaciones/feriado). */
export interface WeekPlan {
  blocked: boolean
  label: string
  days: Partial<Record<DayCode, DayPlan>>
}

/** Confirmación diaria de los apoderados. */
export interface DayConfirm {
  kids: Record<string, 'go' | 'stay'>
  picked: Record<string, boolean>
  driver: string | null
  driverParent: number
}

/** Estado de la ruta de un día (qué paradas ya se entregaron). */
export interface RouteState {
  order?: string[]
  done: Record<string, boolean>
}

export interface School {
  name: string
  text: string
  region: string
  comuna: string
  extra: string
  lat: number | null
  lng: number | null
}

/** El estado completo de la app (igual al `DB` del demo). */
export interface DB {
  families: Family[]
  schedule: Record<string, WeekPlan> // weekKey (lunes ISO) -> WeekPlan
  confirm: Record<string, DayConfirm> // dateKey -> DayConfirm
  exitTimes: Record<DayCode, string>
  routeState: Record<string, RouteState> // dateKey -> RouteState
  school: School
  manualOrder: string[] | null // null = orden automático
}
