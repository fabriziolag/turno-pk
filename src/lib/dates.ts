import type { DayCode } from './types'

export const DAYS: DayCode[] = ['lun', 'mar', 'mie', 'jue', 'vie']

export const DAY_LABEL: Record<DayCode, string> = {
  lun: 'Lunes',
  mar: 'Martes',
  mie: 'Miércoles',
  jue: 'Jueves',
  vie: 'Viernes',
}

/** Lunes de la semana que contiene a `d` (00:00). */
export function startOfWeek(d: Date | string): Date {
  const x = new Date(d)
  const day = (x.getDay() + 6) % 7 // lun = 0
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - day)
  return x
}

/** Clave de semana = fecha del lunes en formato YYYY-MM-DD. */
export function weekKey(d: Date | string): string {
  return startOfWeek(d).toISOString().slice(0, 10)
}

/** Clave de día = fecha en formato YYYY-MM-DD. */
export function dateKey(d: Date | string): string {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.toISOString().slice(0, 10)
}

export function addDays(d: Date | string, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** "12 jun – 16 jun" para el encabezado de la semana. */
export function fmtRange(monday: Date): string {
  const fri = addDays(monday, 4)
  const f = (x: Date) => x.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
  return `${f(monday)} – ${f(fri)}`
}

export function dayCode(d: Date | string): DayCode {
  return DAYS[(new Date(d).getDay() + 6) % 7]
}

export function isWeekday(d: Date | string): boolean {
  const wd = new Date(d).getDay()
  return wd >= 1 && wd <= 5
}

export function prettyDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function capitalize(s: string): string {
  return s.replace(/^\w/, (c) => c.toUpperCase())
}
