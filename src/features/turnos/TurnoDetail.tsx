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

const field =
  'w-full rounded-[10px] border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-leaf focus:ring-[3px] focus:ring-leaf/15'

export function TurnoDetail({
  turno,
  ctx,
  onBack,
}: {
  turno: MyTurno
  ctx: MyContext
  onBack: () => void
}) {
  const { profile, family, kids } = ctx
  const { toast } = useToast()
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
    const url = window.location.origin
    const msg = `¡Te invito al turno ${turno.emoji} ${turno.name} en Turno PK! Entra con tu correo (${target}) acá: ${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div className="min-h-dvh px-4 py-6">
      <div className="mx-auto w-full max-w-lg">
        <button className="mb-3 text-sm font-semibold text-emerald-200/80 hover:text-white" onClick={onBack}>
          ‹ Mis turnos
        </button>

        <div className="rounded-3xl bg-panel p-6 shadow-2xl shadow-black/30">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-panel2 text-2xl">{turno.emoji}</div>
            <h1 className="font-display text-xl font-semibold text-ink">{turno.name}</h1>
          </div>

          {/* Miembros */}
          <div className="mt-5 font-display text-[15px] font-semibold text-leaf">👨‍👩‍👧 Familias del turno</div>
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

          {/* Mis hijos en este turno */}
          <hr className="my-4 border-line" />
          <div className="font-display text-[15px] font-semibold text-leaf">🧒 ¿Qué hijos míos van en este turno?</div>
          <div className="mt-2">
            <KidPicker kids={kids} selected={myKids} onChange={setMyKids} />
            <Button variant="ghost" sm className="mt-2" onClick={saveMyKids}>
              Guardar mis hijos
            </Button>
          </div>

          {/* Invitar */}
          <hr className="my-4 border-line" />
          <div className="font-display text-[15px] font-semibold text-leaf">✉️ Invitar a otra familia</div>
          <p className="mt-1 text-[12px] text-ink-soft">
            Agrega su correo. Cuando esa persona entre a la app (con ese mismo correo), verá la invitación y elige a sus hijos.
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
            <Button variant="primary" onClick={invite} disabled={busy || !email.trim()}>
              Invitar
            </Button>
          </div>

          {pending.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Pendientes</div>
              {pending.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg bg-panel2 px-3 py-2 text-xs">
                  <span className="text-ink">{p.email}</span>
                  <button className="font-semibold text-[#1faa52]" onClick={() => shareWhatsApp(p.email)}>
                    💬 Avisar
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-dashed border-gold bg-[#fbf3da] p-4 text-center text-[12px] leading-relaxed text-[#6b551d]">
            📅 Próximamente: la <b>planificación diaria</b>, la <b>ruta</b> y los horarios de este turno.
          </div>
        </div>
      </div>
    </div>
  )
}
