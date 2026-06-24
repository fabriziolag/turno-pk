import { useCallback, useEffect, useState } from 'react'
import { Button } from '../../components/ui'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/toastStore'
import type { MyContext } from '../../lib/identity'
import { signOut } from '../../lib/identity'
import {
  acceptInvite,
  createTurno,
  getMyTurnos,
  getPendingInvites,
  type MyTurno,
  type PendingInvite,
} from '../../lib/turnos'
import { KidPicker } from './KidPicker'
import { TurnoDetail } from './TurnoDetail'
import { MiFamilia } from '../onboarding/MiFamilia'

const EMOJIS = ['🚐', '🚌', '🚗', '🏫', '🎒', '⭐', '🌟', '🦊', '🐢', '🐝', '🚀', '🌈', '⚽', '🎨', '🦁', '🐧']
const field =
  'w-full rounded-[10px] border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-leaf focus:ring-[3px] focus:ring-leaf/15'

export function TurnosHome({ ctx, reload }: { ctx: MyContext; reload: () => void }) {
  const { profile, family, kids } = ctx
  const { toast } = useToast()
  const [turnos, setTurnos] = useState<MyTurno[]>([])
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [accepting, setAccepting] = useState<PendingInvite | null>(null)
  const [editing, setEditing] = useState(false)

  const load = useCallback(async () => {
    if (!family) return
    setLoading(true)
    try {
      const [t, i] = await Promise.all([getMyTurnos(family.id), getPendingInvites(profile.email)])
      setTurnos(t)
      setInvites(i)
    } catch {
      toast('No se pudieron cargar tus turnos', 'warn')
    } finally {
      setLoading(false)
    }
  }, [family, profile.email, toast])

  useEffect(() => {
    void load()
  }, [load])

  if (editing) return <MiFamilia ctx={ctx} onBack={() => setEditing(false)} onChanged={reload} />

  const open = turnos.find((t) => t.id === openId) ?? null
  if (open) return <TurnoDetail turno={open} ctx={ctx} onBack={() => { setOpenId(null); void load() }} />

  return (
    <div className="min-h-dvh px-4 py-6">
      <div className="mx-auto w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-3 px-1 text-white">
          <div className="grid size-10 flex-none place-items-center rounded-xl bg-gradient-to-br from-gold to-gold-deep text-xl shadow-lg shadow-gold/30">
            🚐
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg font-semibold leading-none">Hola, {profile.name || 'apoderado'}</div>
            <div className="mt-1 text-[11.5px] text-emerald-200/80">Familia {family?.fam_name || '—'}</div>
          </div>
          <button
            className="text-[11px] font-semibold text-emerald-200/80 hover:text-white"
            onClick={() => setEditing(true)}
          >
            Mi familia
          </button>
          <button className="text-[11px] font-semibold text-emerald-200/70 hover:text-white" onClick={() => void signOut()}>
            Salir
          </button>
        </div>

        {/* Invitaciones pendientes */}
        {invites.length > 0 && (
          <div className="mt-5 rounded-3xl bg-panel p-5 shadow-2xl shadow-black/30">
            <div className="font-display text-[15px] font-semibold text-leaf">✉️ Te invitaron a un turno</div>
            <div className="mt-2 space-y-2">
              {invites.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3">
                  <div className="grid size-10 flex-none place-items-center rounded-xl bg-panel2 text-xl">
                    {inv.turno?.emoji ?? '🚐'}
                  </div>
                  <div className="min-w-0 flex-1 text-sm font-semibold text-ink">{inv.turno?.name ?? 'Turno'}</div>
                  <Button variant="primary" sm onClick={() => setAccepting(inv)}>
                    Aceptar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mis turnos */}
        <div className="mt-5 rounded-3xl bg-panel p-5 shadow-2xl shadow-black/30">
          <div className="flex items-center justify-between">
            <div className="font-display text-[15px] font-semibold text-leaf">📅 Tus turnos</div>
            <Button variant="gold" sm onClick={() => setShowCreate(true)}>
              ➕ Crear turno
            </Button>
          </div>

          {loading ? (
            <p className="mt-3 text-sm text-ink-soft">Cargando…</p>
          ) : turnos.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-line bg-panel2 px-5 py-8 text-center">
              <div className="text-3xl">📭</div>
              <p className="mt-2 text-sm text-ink-soft">
                Aún no tienes turnos. Crea uno (emoji + nombre) e invita a las familias.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {turnos.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setOpenId(t.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-3 text-left transition hover:bg-panel2"
                >
                  <div className="grid size-11 flex-none place-items-center rounded-xl bg-panel2 text-2xl">{t.emoji}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-base font-semibold text-ink">{t.name}</div>
                    <div className="text-[11px] text-ink-soft">
                      {t.myKidIds.length} {t.myKidIds.length === 1 ? 'hijo tuyo' : 'hijos tuyos'} en este turno
                    </div>
                  </div>
                  <span className="text-ink-soft">›</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreate && family && (
        <CreateTurnoModal
          ctx={ctx}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            void load()
            toast('Turno creado ✓', 'ok')
          }}
        />
      )}

      {accepting && family && (
        <AcceptModal
          invite={accepting}
          kids={kids}
          familyId={family.id}
          onClose={() => setAccepting(null)}
          onAccepted={() => {
            setAccepting(null)
            void load()
            toast('Te uniste al turno ✓', 'ok')
          }}
        />
      )}
    </div>
  )
}

function CreateTurnoModal({
  ctx,
  onClose,
  onCreated,
}: {
  ctx: MyContext
  onClose: () => void
  onCreated: () => void
}) {
  const { profile, family, kids } = ctx
  const { toast } = useToast()
  const [emoji, setEmoji] = useState('🚐')
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<string[]>(kids.map((k) => k.id))
  const [busy, setBusy] = useState(false)

  async function create() {
    if (!name.trim() || !family || busy) return
    setBusy(true)
    try {
      await createTurno(profile.id, emoji, name, family.id, selected)
      onCreated()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo crear', 'warn')
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Crear turno"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={create} disabled={busy || !name.trim()}>
            {busy ? 'Creando…' : 'Crear turno'}
          </Button>
        </>
      }
    >
      <label className="mb-1.5 block text-xs font-semibold text-ink">Emoji</label>
      <div className="flex flex-wrap gap-1.5">
        {EMOJIS.map((e) => (
          <button
            key={e}
            onClick={() => setEmoji(e)}
            className={`grid size-10 place-items-center rounded-xl text-xl transition ${
              emoji === e ? 'bg-leaf/20 ring-2 ring-leaf' : 'bg-panel2 hover:bg-[#e9e4d3]'
            }`}
          >
            {e}
          </button>
        ))}
      </div>

      <label className="mb-1.5 mt-4 block text-xs font-semibold text-ink">Nombre del turno</label>
      <input
        className={field}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ej: Furgón mañana / Colegio Saint George"
        autoFocus
      />

      <label className="mb-1.5 mt-4 block text-xs font-semibold text-ink">¿Qué hijos tuyos van en este turno?</label>
      <KidPicker kids={kids} selected={selected} onChange={setSelected} />
    </Modal>
  )
}

function AcceptModal({
  invite,
  kids,
  familyId,
  onClose,
  onAccepted,
}: {
  invite: PendingInvite
  kids: MyContext['kids']
  familyId: string
  onClose: () => void
  onAccepted: () => void
}) {
  const { toast } = useToast()
  const [selected, setSelected] = useState<string[]>(kids.map((k) => k.id))
  const [busy, setBusy] = useState(false)

  async function accept() {
    if (busy) return
    setBusy(true)
    try {
      await acceptInvite(invite.id, invite.turno_id, familyId, selected)
      onAccepted()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo aceptar', 'warn')
      setBusy(false)
    }
  }

  return (
    <Modal
      title={`Unirte a ${invite.turno?.emoji ?? ''} ${invite.turno?.name ?? 'turno'}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={accept} disabled={busy}>
            {busy ? 'Uniéndote…' : 'Unirme'}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-ink-soft">Elige qué hijos tuyos van en este turno:</p>
      <KidPicker kids={kids} selected={selected} onChange={setSelected} />
    </Modal>
  )
}
