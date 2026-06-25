import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/ui'
import { useToast } from '../../components/toastStore'
import { addDays, dateKey, dayCode, isWeekday, prettyDate, startOfWeek, weekKey, capitalize } from '../../lib/dates'
import { emptyDoc, loadTurnoDoc, saveTurnoDoc, type TurnoDoc } from '../../lib/turnodoc'
import type { MyTurno, TurnoMemberView } from '../../lib/turnos'

export function TurnoHoy({ turno, members }: { turno: MyTurno; members: TurnoMemberView[] }) {
  const { toast } = useToast()
  const [doc, setDoc] = useState<TurnoDoc>(emptyDoc())
  const [anchor, setAnchor] = useState(() => new Date())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setDoc(await loadTurnoDoc(turno.id))
    } finally {
      setLoading(false)
    }
  }, [turno.id])
  useEffect(() => {
    void load()
  }, [load])

  const famName = useMemo(() => new Map(members.map((m) => [m.family_id, m.fam_name])), [members])
  const kidName = useMemo(() => {
    const map = new Map<string, string>()
    members.forEach((m) => m.kids.forEach((k) => map.set(k.id, k.name)))
    return map
  }, [members])

  const wk = weekKey(startOfWeek(anchor))
  const dc = dayCode(anchor)
  const dk = dateKey(anchor)
  const week = doc.schedule[wk]
  const day = week && !week.blocked ? week.days[dc] : undefined
  const confirm = doc.confirm[dk] ?? { kids: {}, driver: day?.driver ?? null, driverParent: null }
  const exitT = turno.exit_times?.[dc]

  async function persist(next: TurnoDoc) {
    setDoc(next)
    try {
      await saveTurnoDoc(turno.id, next)
    } catch {
      toast('No se pudo guardar', 'warn')
    }
  }
  function patchConfirm(fn: (c: typeof confirm) => void) {
    const next = structuredClone(doc)
    const c = next.confirm[dk] ?? { kids: {}, driver: day?.driver ?? null, driverParent: null }
    fn(c)
    next.confirm[dk] = c
    void persist(next)
  }
  const setStatus = (kid: string, status: 'go' | 'stay') => patchConfirm((c) => { c.kids[kid] = status })
  const setDriver = (fam: string | null) => patchConfirm((c) => { c.driver = fam })

  function sendWhatsApp() {
    if (!day) return
    const going = day.kids.filter((k) => (confirm.kids[k] ?? 'go') === 'go')
    const stay = day.kids.filter((k) => (confirm.kids[k] ?? 'go') === 'stay')
    const drv = confirm.driver ? famName.get(confirm.driver) : null
    let msg = `🚐 *${turno.emoji} ${turno.name}* — ${prettyDate(anchor)}\n`
    if (exitT) msg += `🕐 Salida: ${exitT}\n`
    msg += `🚐 Conduce: ${drv ? `Familia ${drv}` : 'por confirmar'}\n\n`
    msg += `✅ Van (${going.length}): ${going.map((k) => kidName.get(k)).join(', ') || '—'}\n`
    if (stay.length) msg += `🏠 No van: ${stay.map((k) => kidName.get(k)).join(', ')}\n`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function downloadICS() {
    if (!day) return
    const [hh, mm] = (exitT || '13:20').split(':')
    const start = new Date(anchor)
    start.setHours(+hh, +mm, 0, 0)
    const end = new Date(start)
    end.setMinutes(end.getMinutes() + 60)
    const fmt = (x: Date) => x.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
    const drv = confirm.driver ? famName.get(confirm.driver) : ''
    const going = day.kids
      .filter((k) => (confirm.kids[k] ?? 'go') === 'go')
      .map((k) => kidName.get(k))
      .join(', ')
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//TurnoPK//ES\nBEGIN:VEVENT\nUID:${dk}-${turno.id}@turnopk\nDTSTAMP:${fmt(new Date())}\nDTSTART:${fmt(start)}\nDTEND:${fmt(end)}\nSUMMARY:🚐 ${turno.name}${drv ? ` — conduce ${drv}` : ''}\nDESCRIPTION:Niños: ${going}. Salida ${exitT ?? ''}.\nBEGIN:VALARM\nTRIGGER:-PT30M\nACTION:DISPLAY\nDESCRIPTION:Turno en 30 min\nEND:VALARM\nEND:VEVENT\nEND:VCALENDAR`
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
    a.download = `turno-${dk}.ics`
    a.click()
    toast('Archivo .ics descargado ✓', 'ok')
  }

  const label = dateKey(anchor) === dateKey(new Date()) ? 'Hoy' : capitalize(prettyDate(anchor))

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="font-display text-lg font-semibold text-ink">{capitalize(prettyDate(anchor))}</div>
        <div className="flex items-center gap-2 rounded-xl bg-panel2 p-1">
          <button onClick={() => setAnchor(addDays(anchor, -1))} className="grid size-7 place-items-center rounded-lg bg-white text-leaf">‹</button>
          <span className="px-1 text-xs font-semibold">{label}</span>
          <button onClick={() => setAnchor(addDays(anchor, 1))} className="grid size-7 place-items-center rounded-lg bg-white text-leaf">›</button>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-ink-soft">Cargando…</p>
      ) : !isWeekday(anchor) ? (
        <Empty icon="🌿" title="Fin de semana" sub="No hay turno de furgón." />
      ) : week?.blocked ? (
        <Empty icon="⛱" title={week.label || 'Semana sin turnos'} sub="" />
      ) : !day || !day.kids.length ? (
        <Empty icon="📋" title="Sin turno definido para este día" sub="Ve a la pestaña Grilla para asignar niños y conductor." />
      ) : (
        <>
          <div className="mt-3 rounded-2xl border border-gold bg-[#fbf3da] p-3 text-[13px] text-[#6b551d]">
            🕐 Salida: <b>{exitT || '—'}</b>
            <div className="mt-1">
              🚐 Conduce:{' '}
              <select
                value={confirm.driver ?? ''}
                onChange={(e) => setDriver(e.target.value || null)}
                className="rounded-md border border-line bg-white px-2 py-1 text-[12px] font-semibold text-ink"
              >
                <option value="">— por confirmar —</option>
                {members.map((m) => (
                  <option key={m.family_id} value={m.family_id}>Familia {m.fam_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 font-display text-[15px] font-semibold text-leaf">✅ ¿Quién va hoy?</div>
          <div className="mt-2 space-y-2">
            {day.kids.map((kid) => {
              const status = confirm.kids[kid] ?? 'go'
              return (
                <div key={kid} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3">
                  <div className="flex-1 text-sm font-semibold text-ink">{kidName.get(kid) ?? '?'}</div>
                  <div className="flex gap-0 rounded-[10px] bg-panel2 p-1">
                    <button
                      onClick={() => setStatus(kid, 'go')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${status === 'go' ? 'bg-leaf text-white' : 'text-ink-soft'}`}
                    >
                      Va ✓
                    </button>
                    <button
                      onClick={() => setStatus(kid, 'stay')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${status === 'stay' ? 'bg-clay text-white' : 'text-ink-soft'}`}
                    >
                      No va
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="wa" onClick={sendWhatsApp}>💬 Enviar plan por WhatsApp</Button>
            <Button variant="gold" onClick={downloadICS}>📅 Agendar (.ics)</Button>
          </div>
        </>
      )}
    </div>
  )
}

function Empty({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-line bg-panel2 px-5 py-10 text-center">
      <div className="text-4xl">{icon}</div>
      <div className="mt-2 font-display text-base font-semibold text-ink">{title}</div>
      {sub && <p className="mt-1 text-sm text-ink-soft">{sub}</p>}
    </div>
  )
}
