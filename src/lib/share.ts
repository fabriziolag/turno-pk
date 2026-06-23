import type { DayCode, DayConfirm, DayPlan, Family, School } from './types'
import { dateKey, dayCode, prettyDate } from './dates'
import { driverLabel, driverShort } from './format'
import { computeRoute } from './geo'

export function goingKids(day: DayPlan, c: DayConfirm): string[] {
  return day.kids.filter((k) => (c.kids[k] || 'go') === 'go')
}

/** Abre WhatsApp con el plan del día para compartir al grupo. */
export function waPlan(
  date: Date,
  day: DayPlan,
  c: DayConfirm,
  families: Family[],
  school: School,
  exitTimes: Record<DayCode, string>,
  manualOrder: string[] | null,
) {
  const get = (id: string) => families.find((f) => f.id === id)
  const going = goingKids(day, c)
    .map(get)
    .filter((f): f is Family => Boolean(f))
  const stay = day.kids
    .filter((k) => (c.kids[k] || 'go') === 'stay')
    .map(get)
    .filter((f): f is Family => Boolean(f))
  const dc = dayCode(date)
  const driverFam = c.driver ? get(c.driver) : undefined

  let msg = `🚐 *Turno PK — ${prettyDate(date)}*\n`
  msg += `🕐 Salida: ${exitTimes[dc] || '—'}\n`
  msg += `👤 Retira: ${c.driver ? driverLabel(driverFam, c.driverParent) : 'por confirmar'}\n\n`
  msg += `✅ Van (${going.length}): ${going.map((f) => f.kidName).join(', ') || '—'}\n`
  if (stay.length) msg += `🏠 No van: ${stay.map((f) => f.kidName).join(', ')}\n`
  msg += `\nOrden de entrega:\n`
  const order = computeRoute(going, c.driver, school, manualOrder)
  order.forEach((f, i) => (msg += `${i + 1}. ${f.kidName}\n`))

  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
}

/** Genera y descarga un archivo .ics para agendar el turno (con alarma 30 min antes). */
export function downloadICS(
  date: Date,
  day: DayPlan,
  c: DayConfirm,
  families: Family[],
  exitTimes: Record<DayCode, string>,
) {
  const dc = dayCode(date)
  const [hh, mm] = (exitTimes[dc] || '13:20').split(':')
  const start = new Date(date)
  start.setHours(+hh, +mm, 0, 0)
  const end = new Date(start)
  end.setMinutes(end.getMinutes() + 60)
  const fmt = (x: Date) => x.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
  const get = (id: string) => families.find((f) => f.id === id)
  const driverFam = c.driver ? get(c.driver) : undefined
  const going = goingKids(day, c)
    .map((k) => get(k)?.kidName)
    .filter(Boolean)
    .join(', ')

  const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TurnoPK//ES
BEGIN:VEVENT
UID:${dateKey(date)}-turnopk@local
DTSTAMP:${fmt(new Date())}
DTSTART:${fmt(start)}
DTEND:${fmt(end)}
SUMMARY:🚐 Turno furgón${c.driver ? ` — retira ${driverShort(driverFam, c.driverParent)}` : ''}
DESCRIPTION:Niños: ${going}. Salida ${exitTimes[dc]}.
BEGIN:VALARM
TRIGGER:-PT30M
ACTION:DISPLAY
DESCRIPTION:Turno furgón en 30 min
END:VALARM
END:VEVENT
END:VCALENDAR`

  const blob = new Blob([ics], { type: 'text/calendar' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `turno-${dateKey(date)}.ics`
  a.click()
}

/** Abre WhatsApp avisando que un niño fue entregado. */
export function waDelivered(f: Family) {
  const phones = f.parents.filter((p) => p.phone).map((p) => p.phone.replace(/[^\d]/g, ''))
  const msg = encodeURIComponent(`✅ ${f.kidName} fue entregado/a en casa sano y salvo. 🚐 Turno PK`)
  window.open(phones.length ? `https://wa.me/${phones[0]}?text=${msg}` : `https://wa.me/?text=${msg}`, '_blank')
}
