import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/ui'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/toastStore'
import { DAYS, DAY_LABEL, addDays, fmtRange, startOfWeek, weekKey } from '../../lib/dates'
import { famColor } from '../../lib/format'
import { emptyDoc, loadTurnoDoc, saveTurnoDoc, type TDDayPlan, type TurnoDoc } from '../../lib/turnodoc'
import type { MyTurno, TurnoMemberView } from '../../lib/turnos'
import type { DayCode } from '../../lib/types'

export function TurnoGrilla({ turno, members }: { turno: MyTurno; members: TurnoMemberView[] }) {
  const { toast } = useToast()
  const [doc, setDoc] = useState<TurnoDoc>(emptyDoc())
  const [anchor, setAnchor] = useState(() => new Date())
  const [editing, setEditing] = useState<DayCode | null>(null)
  const [blocking, setBlocking] = useState(false)
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

  const monday = startOfWeek(anchor)
  const wk = weekKey(monday)
  const week = doc.schedule[wk] ?? { blocked: false, label: '', days: {} }

  const famName = useMemo(() => new Map(members.map((m) => [m.family_id, m.fam_name])), [members])
  const famIdx = useMemo(() => new Map(members.map((m, i) => [m.family_id, i])), [members])
  const kidName = useMemo(() => {
    const map = new Map<string, string>()
    members.forEach((m) => m.kids.forEach((k) => map.set(k.id, k.name)))
    return map
  }, [members])

  async function persist(next: TurnoDoc) {
    setDoc(next)
    try {
      await saveTurnoDoc(turno.id, next)
    } catch {
      toast('No se pudo guardar', 'warn')
    }
  }
  function setDay(dc: DayCode, plan: TDDayPlan) {
    const next = structuredClone(doc)
    next.schedule[wk] = next.schedule[wk] ?? { blocked: false, label: '', days: {} }
    next.schedule[wk].days[dc] = plan
    void persist(next)
  }
  function blockWeek(label: string) {
    const next = structuredClone(doc)
    next.schedule[wk] = { blocked: true, label: label || 'Sin turnos', days: next.schedule[wk]?.days ?? {} }
    void persist(next)
  }
  function unblockWeek() {
    const next = structuredClone(doc)
    next.schedule[wk] = { blocked: false, label: '', days: next.schedule[wk]?.days ?? {} }
    void persist(next)
  }

  if (loading) return <p className="px-1 py-6 text-sm text-emerald-200/80">Cargando grilla…</p>
  if (!members.length)
    return (
      <div className="rounded-2xl border border-dashed border-line bg-panel2 px-5 py-8 text-center text-sm text-ink-soft">
        Aún no hay familias con hijos en este turno. Invita familias en la pestaña <b>Equipo</b>.
      </div>
    )

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2 rounded-xl bg-panel2 p-1.5">
          <button onClick={() => setAnchor(addDays(monday, -7))} className="grid size-8 place-items-center rounded-lg bg-white text-lg text-leaf shadow-sm">‹</button>
          <span className="min-w-[150px] px-1.5 text-center text-sm font-semibold">{fmtRange(monday)}</span>
          <button onClick={() => setAnchor(addDays(monday, 7))} className="grid size-8 place-items-center rounded-lg bg-white text-lg text-leaf shadow-sm">›</button>
        </div>
        <Button variant="ghost" sm onClick={() => setAnchor(new Date())}>Semana actual</Button>
        <Button variant="ghost" sm onClick={() => (week.blocked ? unblockWeek() : setBlocking(true))}>
          {week.blocked ? '✅ Desbloquear' : '⛱ Bloquear semana'}
        </Button>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-leaf text-white">
              <th className="px-3 py-2.5 text-left text-xs font-semibold">Día</th>
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
                const drv = day.driver ? famName.get(day.driver) : null
                const exitT = turno.exit_times?.[dc]
                return (
                  <tr key={dc} className="border-t border-line">
                    <td className="px-3 py-2.5 text-left font-semibold">
                      {DAY_LABEL[dc]}
                      <div className="text-[11px] font-normal tabular-nums text-ink-soft">
                        {date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })}
                      </div>
                      {exitT && <div className="text-[11px] font-semibold text-gold-deep">🕐 {exitT}</div>}
                    </td>
                    <td className="cursor-pointer px-2 py-2.5 text-center hover:bg-panel2" onClick={() => setEditing(dc)}>
                      {day.kids.length ? (
                        <div className="flex flex-wrap justify-center gap-1">
                          {day.kids.map((kid) => (
                            <span key={kid} className="rounded-md bg-leaf/15 px-2 py-0.5 text-[11px] font-semibold text-leaf">
                              {kidName.get(kid) ?? '?'}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-ink-soft">— sin definir —</span>
                      )}
                    </td>
                    <td className="cursor-pointer px-2 py-2.5 text-center hover:bg-panel2" onClick={() => setEditing(dc)}>
                      {drv ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-bold text-[#1a1206]"
                          style={{ background: famColor(famIdx.get(day.driver!) ?? 0) }}
                        >
                          🚐 {drv}
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

      {editing && (
        <DayEditor
          dc={editing}
          date={addDays(monday, DAYS.indexOf(editing))}
          plan={week.days[editing] ?? { kids: [], driver: null }}
          members={members}
          onClose={() => setEditing(null)}
          onSave={(plan) => {
            setDay(editing, plan)
            setEditing(null)
            toast('Día actualizado ✓', 'ok')
          }}
        />
      )}
      {blocking && (
        <BlockModal
          current={week.label}
          onClose={() => setBlocking(false)}
          onConfirm={(label) => {
            blockWeek(label)
            setBlocking(false)
          }}
        />
      )}
    </div>
  )
}

function DayEditor({
  dc,
  date,
  plan,
  members,
  onClose,
  onSave,
}: {
  dc: DayCode
  date: Date
  plan: TDDayPlan
  members: TurnoMemberView[]
  onClose: () => void
  onSave: (plan: TDDayPlan) => void
}) {
  const [kids, setKids] = useState<string[]>(plan.kids)
  const [driver, setDriver] = useState<string | null>(plan.driver)
  const toggle = (id: string) => setKids((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  return (
    <Modal
      title={`${DAY_LABEL[dc]} ${date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={() => onSave({ kids, driver })}>💾 Guardar día</Button>
        </>
      }
    >
      <div className="mb-2 font-display text-[15px] font-semibold text-leaf">🧒 ¿Qué niños van?</div>
      <div className="space-y-3">
        {members.map((m) => (
          <div key={m.family_id}>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Familia {m.fam_name}</div>
            <div className="space-y-1.5">
              {m.kids.length ? (
                m.kids.map((k) => (
                  <label key={k.id} className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-line p-2.5">
                    <input type="checkbox" checked={kids.includes(k.id)} onChange={() => toggle(k.id)} className="size-4 accent-leaf" />
                    <span className="text-sm font-semibold text-ink">{k.name}</span>
                  </label>
                ))
              ) : (
                <span className="text-[11px] text-ink-soft">sin hijos en el turno</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <hr className="my-4 border-line" />
      <label className="mb-1.5 block text-xs font-semibold text-ink">🚐 ¿Qué familia conduce?</label>
      <select
        value={driver ?? ''}
        onChange={(e) => setDriver(e.target.value || null)}
        className="w-full rounded-[10px] border-[1.5px] border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-leaf"
      >
        <option value="">— elegir —</option>
        {members.map((m) => (
          <option key={m.family_id} value={m.family_id}>Familia {m.fam_name}</option>
        ))}
      </select>
      <p className="mt-1.5 text-[11.5px] text-ink-soft">Los hijos de esta familia serán la última parada de la ruta.</p>
    </Modal>
  )
}

function BlockModal({
  current,
  onClose,
  onConfirm,
}: {
  current: string
  onClose: () => void
  onConfirm: (label: string) => void
}) {
  const [label, setLabel] = useState(current)
  return (
    <Modal
      title="Bloquear semana"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="gold" onClick={() => onConfirm(label.trim())}>⛱ Bloquear</Button>
        </>
      }
    >
      <label className="mb-1.5 block text-xs font-semibold text-ink">Motivo</label>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Vacaciones / Fiestas patrias / Feriado"
        className="w-full rounded-[10px] border-[1.5px] border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-leaf"
      />
    </Modal>
  )
}
