import { useCallback, useEffect, useState } from 'react'
import { Button } from '../../components/ui'
import { useToast } from '../../components/toastStore'
import type { MyContext } from '../../lib/identity'
import {
  getTurnoMembers,
  getTurnoPendingInvites,
  inviteToTurno,
  updateMyKids,
  type MyTurno,
  type TurnoMemberView,
} from '../../lib/turnos'
import { KidPicker } from './KidPicker'
import { TurnoGrilla } from './TurnoGrilla'
import { TurnoAjustes } from './TurnoAjustes'

const field =
  'w-full rounded-[10px] border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-leaf focus:ring-[3px] focus:ring-leaf/15'

type Tab = 'grilla' | 'hoy' | 'ruta' | 'equipo' | 'ajustes'
const TABS: { id: Tab; label: string }[] = [
  { id: 'grilla', label: '📅 Grilla' },
  { id: 'hoy', label: '☀️ Hoy' },
  { id: 'ruta', label: '🗺️ Ruta' },
  { id: 'equipo', label: '👨‍👩‍👧 Equipo' },
  { id: 'ajustes', label: '⚙️ Ajustes' },
]

export function TurnoDetail({
  turno,
  ctx,
  onBack,
  onChanged,
}: {
  turno: MyTurno
  ctx: MyContext
  onBack: () => void
  onChanged: () => void
}) {
  const { profile, family, kids } = ctx
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('grilla')
  const [members, setMembers] = useState<TurnoMemberView[]>([])
  const [pending, setPending] = useState<{ id: string; email: string }[]>([])
  const [myKids, setMyKids] = useState<string[]>(turno.myKidIds)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [m, p] = await Promise.all([getTurnoMembers(turno.id), getTurnoPendingInvites(turno.id)])
    setMembers(m)
    setPending(p)
  }, [turno.id])
  useEffect(() => {
    void load()
  }, [load])

  async function saveMyKids() {
    if (!family) return
    try {
      await updateMyKids(turno.id, family.id, myKids)
      toast('Hijos actualizados ✓', 'ok')
      void load()
    } catch {
      toast('No se pudo actualizar', 'warn')
    }
  }
  async function invite() {
    const e = email.trim()
    if (!e) return
    setBusy(true)
    try {
      await inviteToTurno(turno.id, e, profile.id)
      setEmail('')
      toast('Invitación creada ✓', 'ok')
      void load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo invitar', 'warn')
    } finally {
      setBusy(false)
    }
  }
  function shareWhatsApp(target: string) {
    const msg = `¡Te invito al turno ${turno.emoji} ${turno.name} en Turno PK! Entra con tu correo (${target}) acá: ${window.location.origin}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div className="min-h-dvh px-4 py-6">
      <div className="mx-auto w-full max-w-lg">
        <button className="mb-3 text-sm font-semibold text-emerald-200/80 hover:text-white" onClick={onBack}>
          ‹ Mis turnos
        </button>

        <div className="flex items-center gap-3 px-1">
          <div className="grid size-12 place-items-center rounded-2xl bg-panel2 text-2xl">{turno.emoji}</div>
          <h1 className="font-display text-xl font-semibold text-white">{turno.name}</h1>
        </div>

        {/* Tabs */}
        <div className="mt-3 flex gap-1 overflow-x-auto [scrollbar-width:none]">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-none whitespace-nowrap rounded-t-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                tab === t.id ? 'bg-panel text-ink' : 'text-emerald-200/70 hover:text-emerald-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="rounded-b-2xl rounded-tr-2xl bg-panel p-5 shadow-2xl shadow-black/30">
          {tab === 'grilla' && <TurnoGrilla turno={turno} members={members} />}

          {tab === 'ajustes' && <TurnoAjustes turno={turno} onSaved={onChanged} />}

          {(tab === 'hoy' || tab === 'ruta') && (
            <div className="rounded-2xl border border-dashed border-gold bg-[#fbf3da] p-6 text-center text-[13px] leading-relaxed text-[#6b551d]">
              {tab === 'hoy' ? '☀️' : '🗺️'} <b>Próximamente.</b> Primero arma la <b>Grilla</b> y los{' '}
              <b>Ajustes</b> del turno; la confirmación diaria y la ruta vienen en la siguiente entrega.
            </div>
          )}

          {tab === 'equipo' && (
            <div>
              <div className="font-display text-[15px] font-semibold text-leaf">👨‍👩‍👧 Familias del turno</div>
              <div className="mt-2 space-y-2">
                {members.map((m) => (
                  <div key={m.family_id} className="rounded-2xl border border-line bg-white p-3">
                    <div className="text-sm font-semibold text-ink">
                      Familia {m.fam_name}
                      {m.family_id === family?.id && <span className="ml-1 text-[11px] text-leaf">(tú)</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {m.kids.length ? (
                        m.kids.map((k) => (
                          <span key={k.id} className="rounded-md bg-leaf/15 px-2 py-0.5 text-xs font-semibold text-leaf">
                            {k.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-ink-soft">sin hijos en este turno</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <hr className="my-4 border-line" />
              <div className="font-display text-[15px] font-semibold text-leaf">🧒 ¿Qué hijos míos van en este turno?</div>
              <div className="mt-2">
                <KidPicker kids={kids} selected={myKids} onChange={setMyKids} />
                <Button variant="ghost" sm className="mt-2" onClick={saveMyKids}>Guardar mis hijos</Button>
              </div>

              <hr className="my-4 border-line" />
              <div className="font-display text-[15px] font-semibold text-leaf">✉️ Invitar a otra familia</div>
              <p className="mt-1 text-[12px] text-ink-soft">
                Agrega su correo. Cuando entre a la app con ese correo, verá la invitación y elige a sus hijos.
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  className={field}
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && invite()}
                  placeholder="correo@ejemplo.com"
                />
                <Button variant="primary" onClick={invite} disabled={busy || !email.trim()}>Invitar</Button>
              </div>
              {pending.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Pendientes</div>
                  {pending.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg bg-panel2 px-3 py-2 text-xs">
                      <span className="text-ink">{p.email}</span>
                      <button className="font-semibold text-[#1faa52]" onClick={() => shareWhatsApp(p.email)}>💬 Avisar</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
