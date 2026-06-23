import { useStore } from '../../store/store'
import { useView } from '../../store/view'
import { Button } from '../../components/ui'
import {
  addDays,
  capitalize,
  dateKey,
  dayCode,
  isWeekday,
  prettyDate,
  startOfWeek,
  weekKey,
} from '../../lib/dates'
import { driverLabel, famColor, initials } from '../../lib/format'
import { downloadICS, waPlan } from '../../lib/share'
import type { DayConfirm } from '../../lib/types'

export function HoyView() {
  const db = useStore((s) => s.db)
  const setKidStatus = useStore((s) => s.setKidStatus)
  const setConfirmDriver = useStore((s) => s.setConfirmDriver)
  const d = useView((s) => s.hoyAnchor)
  const setHoyAnchor = useView((s) => s.setHoyAnchor)
  const setView = useView((s) => s.setView)

  const isToday = dateKey(d) === dateKey(new Date())

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">Confirmación del día</h2>
        <p className="mt-1 text-sm text-ink-soft">{capitalize(prettyDate(d))}</p>
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-panel2 p-1.5">
        <button onClick={() => setHoyAnchor(addDays(d, -1))} className="grid size-8 place-items-center rounded-lg bg-white text-lg text-leaf shadow-sm">
          ‹
        </button>
        <span className="min-w-[90px] px-1.5 text-center text-sm font-semibold">
          {isToday ? 'Hoy' : d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' })}
        </span>
        <button onClick={() => setHoyAnchor(addDays(d, 1))} className="grid size-8 place-items-center rounded-lg bg-white text-lg text-leaf shadow-sm">
          ›
        </button>
      </div>
    </div>
  )

  function empty(icon: string, title: string, note?: string) {
    return (
      <section>
        {header}
        <div className="mt-10 rounded-2xl border border-dashed border-line bg-panel2 px-6 py-16 text-center">
          <div className="text-5xl opacity-50">{icon}</div>
          <p className="mt-3 font-display text-lg text-ink">{title}</p>
          {note && <p className="mt-1 text-sm text-ink-soft">{note}</p>}
        </div>
      </section>
    )
  }

  if (!isWeekday(d)) return empty('🌿', 'Fin de semana', 'No hay turno de furgón.')

  const wk = weekKey(startOfWeek(d))
  const W = db.schedule[wk]
  const dc = dayCode(d)
  if (W?.blocked) return empty('⛱', W.label || 'Semana sin turnos')

  const day = W?.days[dc] ?? { kids: [], driver: null }
  if (!day.kids.length) {
    return (
      <section>
        {header}
        <div className="mt-10 rounded-2xl border border-dashed border-line bg-panel2 px-6 py-16 text-center">
          <div className="text-5xl opacity-50">📋</div>
          <p className="mt-3 font-display text-lg text-ink">Sin turno definido para este día</p>
          <p className="mt-1 text-sm text-ink-soft">
            Ve a la pestaña <b>Turnos</b> para asignar qué niños van y quién conduce.
          </p>
          <Button variant="primary" className="mt-4" onClick={() => setView('turnos')}>
            Ir a Turnos
          </Button>
        </div>
      </section>
    )
  }

  const dk = dateKey(d)
  const C = db.confirm[dk]
  const effDriver = C?.driver ?? day.driver
  const effParent = C?.driverParent ?? 0
  const exitTime = db.exitTimes[dc] || '—'
  const getFamily = (id: string) => db.families.find((f) => f.id === id)
  const driverFam = effDriver ? getFamily(effDriver) : undefined

  const effC: DayConfirm = {
    kids: C?.kids ?? {},
    picked: C?.picked ?? {},
    driver: effDriver,
    driverParent: effParent,
  }

  const driverValue = effDriver ? `${effDriver}:${effParent}` : ''

  return (
    <section>
      {header}

      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-gold bg-gradient-to-r from-[#fbf3da] to-[#f6eccf] px-4 py-3.5 text-[13px] leading-relaxed text-[#6b551d]">
        <span className="text-xl">🕐</span>
        <div>
          Salida del colegio hoy: <b>{exitTime}</b>.<br />
          Retira hoy: <b>{effDriver ? driverLabel(driverFam, effParent) : 'sin asignar'}</b>.<br />
          Cada apoderado confirma si su hijo va, y quien retira marca a quién recogió.
        </div>
      </div>

      <div className="mt-4 mb-2.5 flex items-center gap-2 font-display text-[15px] font-semibold text-leaf">
        ✅ Confirmación de los apoderados
      </div>
      {day.kids.map((kid) => {
        const f = getFamily(kid)
        if (!f) return null
        const i = db.families.indexOf(f)
        const status = effC.kids[kid] || 'go'
        return (
          <div key={kid} className="mb-3.5 flex items-center gap-3.5 rounded-2xl border border-line bg-white p-4">
            {f.kidPhoto ? (
              <img src={f.kidPhoto} alt="" className="size-[50px] flex-none rounded-full border-2 border-line object-cover" />
            ) : (
              <div className="grid size-[50px] flex-none place-items-center rounded-full font-display text-xl text-white" style={{ background: famColor(i) }}>
                {initials(f.kidName)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-display text-base font-semibold">{f.kidName}</div>
              <div className="text-xs text-ink-soft">Familia {f.famName || '—'}</div>
            </div>
            <div className="flex flex-none gap-0 rounded-[10px] bg-panel2 p-0.5">
              <button
                onClick={() => setKidStatus(dk, kid, 'go')}
                className={`rounded-lg px-3 py-2 text-[12.5px] font-semibold transition ${status === 'go' ? 'bg-leaf text-white' : 'text-ink-soft'}`}
              >
                Va ✓
              </button>
              <button
                onClick={() => setKidStatus(dk, kid, 'stay')}
                className={`rounded-lg px-3 py-2 text-[12.5px] font-semibold transition ${status === 'stay' ? 'bg-clay text-white' : 'text-ink-soft'}`}
              >
                No va
              </button>
            </div>
          </div>
        )
      })}

      <div className="mt-4 mb-1.5 flex items-center gap-2 font-display text-[15px] font-semibold text-leaf">
        🚐 ¿Quién retira hoy?
      </div>
      <select
        value={driverValue}
        onChange={(e) => {
          const v = e.target.value
          if (!v) setConfirmDriver(dk, null, 0, day.driver)
          else {
            const [fid, pidx] = v.split(':')
            setConfirmDriver(dk, fid, Number(pidx) || 0, day.driver)
          }
        }}
        className="w-full rounded-[10px] border-[1.5px] border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-leaf"
      >
        <option value="">— elegir —</option>
        {db.families.map((f) => {
          const named = f.parents.map((p, idx) => ({ p, idx })).filter((o) => o.p && o.p.name)
          if (named.length) {
            return named.map(({ idx }) => (
              <option key={`${f.id}:${idx}`} value={`${f.id}:${idx}`}>
                {driverLabel(f, idx)}
              </option>
            ))
          }
          return (
            <option key={`${f.id}:0`} value={`${f.id}:0`}>
              Familia {f.famName || f.kidName} (apoderado sin nombre)
            </option>
          )
        })}
      </select>
      <p className="mt-1.5 text-[11.5px] text-ink-soft">
        Elige el apoderado que retira. Se puede cambiar día a día. ¿Falta un nombre? Agrégalo en
        Familias → Editar.
      </p>

      <div className="mt-4 flex flex-wrap gap-2.5">
        <Button variant="primary" onClick={() => setView('ruta')}>
          🗺 Ver ruta de hoy
        </Button>
        <Button variant="wa" onClick={() => waPlan(d, day, effC, db.families, db.school, db.exitTimes, db.manualOrder)}>
          💬 Enviar plan por WhatsApp
        </Button>
        <Button variant="gold" onClick={() => downloadICS(d, day, effC, db.families, db.exitTimes)}>
          📅 Agendar (.ics)
        </Button>
      </div>
    </section>
  )
}
