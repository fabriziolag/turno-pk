import { useState } from 'react'
import { useStore } from '../../store/store'
import { useToast } from '../../components/toastStore'
import { Button } from '../../components/ui'
import { Modal } from '../../components/Modal'
import { DAYS, DAY_LABEL, addDays, fmtRange, startOfWeek, weekKey } from '../../lib/dates'
import { famColor } from '../../lib/format'
import type { DayCode, DayPlan, Family } from '../../lib/types'

export function TurnosView() {
  const db = useStore((s) => s.db)
  const setDay = useStore((s) => s.setDay)
  const setWeekBlocked = useStore((s) => s.setWeekBlocked)
  const { toast } = useToast()

  const [anchor, setAnchor] = useState(() => new Date())
  const [editing, setEditing] = useState<DayCode | null>(null)
  const [blocking, setBlocking] = useState(false)

  const monday = startOfWeek(anchor)
  const wk = weekKey(monday)
  const week = db.schedule[wk] ?? { blocked: false, label: '', days: {} }
  const families = db.families
  const getFamily = (id: string) => families.find((f) => f.id === id)
  const famIndex = (id: string) => families.findIndex((f) => f.id === id)

  // contador anual de turnos por familia
  const year = anchor.getFullYear()
  const counts: Record<string, number> = {}
  families.forEach((f) => (counts[f.id] = 0))
  Object.entries(db.schedule).forEach(([k, w]) => {
    if (w.blocked) return
    if (new Date(k).getFullYear() !== year) return
    Object.values(w.days).forEach((d) => {
      if (d?.driver && counts[d.driver] != null) counts[d.driver]++
    })
  })

  return (
    <section>
      <h2 className="font-display text-2xl font-semibold text-ink">Planificación de turnos</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Arma la grilla por semana, como tu Excel. Toca una celda para elegir qué niños van y quién
        conduce. El contador anual mantiene el reparto parejo.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2 rounded-xl bg-panel2 p-1.5">
          <button
            onClick={() => setAnchor(addDays(monday, -7))}
            className="grid size-8 place-items-center rounded-lg bg-white text-lg text-leaf shadow-sm"
          >
            ‹
          </button>
          <span className="min-w-[150px] px-1.5 text-center text-sm font-semibold">{fmtRange(monday)}</span>
          <button
            onClick={() => setAnchor(addDays(monday, 7))}
            className="grid size-8 place-items-center rounded-lg bg-white text-lg text-leaf shadow-sm"
          >
            ›
          </button>
        </div>
        <Button variant="ghost" sm onClick={() => setAnchor(new Date())}>
          Semana actual
        </Button>
        <Button variant="ghost" sm onClick={() => (week.blocked ? setWeekBlocked(wk, false) : setBlocking(true))}>
          {week.blocked ? '✅ Desbloquear semana' : '⛱ Bloquear semana'}
        </Button>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-leaf text-white">
              <th className="px-3.5 py-2.5 text-left text-xs font-semibold">Día</th>
              <th className="px-2 py-2.5 text-center text-xs font-semibold">Niños que van</th>
              <th className="px-2 py-2.5 text-center text-xs font-semibold">Conductor</th>
            </tr>
          </thead>
          <tbody>
            {week.blocked ? (
              <tr>
                <td colSpan={3} className="bg-[#faf6e8] px-3 py-4 text-center font-semibold italic text-gold-deep">
                  ⛱ {week.label || 'Semana bloqueada'} — sin turnos
                </td>
              </tr>
            ) : (
              DAYS.map((dc, i) => {
                const day = week.days[dc] ?? { kids: [], driver: null }
                const date = addDays(monday, i)
                const drv = day.driver ? getFamily(day.driver) : null
                const exitT = db.exitTimes[dc]
                return (
                  <tr key={dc} className="border-t border-line">
                    <td className="px-3.5 py-2.5 text-left font-semibold">
                      {DAY_LABEL[dc]}
                      <div className="text-[11px] font-normal tabular-nums text-ink-soft">
                        {date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })}
                      </div>
                      {exitT && <div className="text-[11px] font-semibold text-gold-deep">🕐 {exitT}</div>}
                    </td>
                    <td className="cursor-pointer px-2 py-2.5 text-center align-middle hover:bg-panel2" onClick={() => setEditing(dc)}>
                      {day.kids.length ? (
                        <div className="flex flex-wrap justify-center gap-1">
                          {day.kids.map((kid) => {
                            const f = getFamily(kid)
                            if (!f) return null
                            const c = famColor(famIndex(kid))
                            return (
                              <span
                                key={kid}
                                className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-[#3a2e15]"
                                style={{ background: `${c}33`, border: `1px solid ${c}` }}
                              >
                                {f.kidName}
                              </span>
                            )
                          })}
                        </div>
                      ) : (
                        <span className="text-[11px] text-ink-soft">— sin definir —</span>
                      )}
                    </td>
                    <td className="cursor-pointer px-2 py-2.5 text-center align-middle hover:bg-panel2" onClick={() => setEditing(dc)}>
                      {drv ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-gold px-2 py-0.5 text-[10.5px] font-bold text-[#1a1206]">
                          🚐 {drv.famName || drv.kidName}
                        </span>
                      ) : (
                        <span className="text-[11px] text-ink-soft">—</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 font-display text-lg font-semibold text-ink">Contador anual de turnos</h2>
      <p className="mt-1 text-sm text-ink-soft">Cuántas veces ha conducido cada familia en {year}.</p>
      {families.length === 0 ? (
        <p className="mt-2 text-xs text-ink-soft">Agrega familias para ver el contador.</p>
      ) : (
        <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          {families.map((f, i) => (
            <div key={f.id} className="relative overflow-hidden rounded-2xl border border-line bg-white p-4">
              <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: famColor(i) }} />
              <div className="pl-2 text-sm font-semibold">{f.famName || f.kidName}</div>
              <div className="pl-2 font-display text-3xl font-bold tabular-nums">{counts[f.id] ?? 0}</div>
              <div className="pl-2 text-[11px] text-ink-soft">turnos en {year}</div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <DayEditor
          dc={editing}
          date={addDays(monday, DAYS.indexOf(editing))}
          plan={week.days[editing] ?? { kids: [], driver: null }}
          families={families}
          onClose={() => setEditing(null)}
          onSave={(plan) => {
            setDay(wk, editing, plan)
            setEditing(null)
            toast('Día actualizado ✓', 'ok')
          }}
        />
      )}

      {blocking && (
        <BlockWeekModal
          current={week.label}
          onClose={() => setBlocking(false)}
          onConfirm={(label) => {
            setWeekBlocked(wk, true, label)
            setBlocking(false)
            toast('Semana bloqueada')
          }}
        />
      )}
    </section>
  )
}

function DayEditor({
  dc,
  date,
  plan,
  families,
  onSave,
  onClose,
}: {
  dc: DayCode
  date: Date
  plan: DayPlan
  families: Family[]
  onSave: (plan: DayPlan) => void
  onClose: () => void
}) {
  const [kids, setKids] = useState<string[]>(plan.kids)
  const [driver, setDriver] = useState<string | null>(plan.driver)
  const toggleKid = (id: string) =>
    setKids((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  return (
    <Modal
      title={`${DAY_LABEL[dc]} ${date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => onSave({ kids, driver })}>
            💾 Guardar día
          </Button>
        </>
      }
    >
      <div className="mb-2.5 flex items-center gap-2 font-display text-[15px] font-semibold text-leaf">
        🧒 ¿Qué niños van este día?
      </div>
      {families.map((f, i) => {
        const c = famColor(i)
        return (
          <label
            key={f.id}
            className="mb-2 flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-line p-2.5"
          >
            <input type="checkbox" checked={kids.includes(f.id)} onChange={() => toggleKid(f.id)} className="w-auto" />
            <span
              className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-[#3a2e15]"
              style={{ background: `${c}33`, border: `1px solid ${c}` }}
            >
              {f.kidName}
            </span>
            <span className="text-[11px] text-ink-soft">{f.famName}</span>
          </label>
        )
      })}

      <hr className="my-4 border-line" />
      <label className="mb-1.5 block text-xs font-semibold text-ink">
        🚐 ¿Qué familia conduce (hace el turno)?
      </label>
      <select
        value={driver ?? ''}
        onChange={(e) => setDriver(e.target.value || null)}
        className="w-full rounded-[10px] border-[1.5px] border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-leaf"
      >
        <option value="">— elegir —</option>
        {families.map((f) => (
          <option key={f.id} value={f.id}>
            {f.famName || f.kidName}
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-[11.5px] text-ink-soft">
        El hijo de esta familia será siempre la última parada de la ruta.
      </p>
    </Modal>
  )
}

function BlockWeekModal({
  current,
  onConfirm,
  onClose,
}: {
  current: string
  onConfirm: (label: string) => void
  onClose: () => void
}) {
  const [label, setLabel] = useState(current)
  return (
    <Modal
      title="Bloquear semana"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="gold" onClick={() => onConfirm(label.trim())}>
            ⛱ Bloquear
          </Button>
        </>
      }
    >
      <label className="mb-1.5 block text-xs font-semibold text-ink">Motivo (aparece en la grilla)</label>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Vacaciones de invierno / Fiestas patrias / Feriado"
        className="w-full rounded-[10px] border-[1.5px] border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-leaf"
      />
    </Modal>
  )
}
