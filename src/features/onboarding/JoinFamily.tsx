import { useState } from 'react'
import { Button } from '../../components/ui'
import { acceptFamilyInvite, signOut, type FamilyInvite } from '../../lib/identity'

const field =
  'w-full rounded-[10px] border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-leaf focus:ring-[3px] focus:ring-leaf/15'
const labelCls = 'mb-1.5 block text-xs font-semibold text-ink'

function RolePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      {['padre', 'madre', 'otro'].map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`flex-1 rounded-[10px] border px-3 py-2 text-sm font-semibold capitalize transition ${
            value === o ? 'border-leaf bg-leaf text-white' : 'border-line bg-white text-ink-soft'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

export function JoinFamily({
  userId,
  invites,
  onJoined,
  onCreateOwn,
}: {
  userId: string
  invites: FamilyInvite[]
  onJoined: () => void
  onCreateOwn: () => void
}) {
  const invite = invites[0]
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [role, setRole] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function join() {
    if (!nombre.trim() || busy) return
    setBusy(true)
    setErr('')
    try {
      await acceptFamilyInvite(invite, userId, nombre, apellido, role)
      onJoined()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo unir. Intenta de nuevo.')
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-md rounded-3xl bg-panel p-6 shadow-2xl shadow-black/30">
        <div className="rounded-2xl bg-leaf/10 p-4 text-center">
          <div className="text-3xl">👨‍👩‍👧</div>
          <p className="mt-2 text-sm text-ink">
            <b>{invite.inviter_name || 'Alguien'}</b> te invitó a unirte a la{' '}
            <b>familia {invite.fam_name || ''}</b>.
          </p>
          <p className="mt-1 text-[12px] text-ink-soft">Compartirán los mismos hijos y datos de la familia.</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Tu nombre</label>
            <input className={field} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="María" />
          </div>
          <div>
            <label className={labelCls}>Tu apellido</label>
            <input className={field} value={apellido} onChange={(e) => setApellido(e.target.value)} placeholder="Pérez" />
          </div>
        </div>
        <label className={`${labelCls} mt-3`}>¿Eres…?</label>
        <RolePicker value={role} onChange={setRole} />

        {err && <p className="mt-3 text-xs text-clay">{err}</p>}

        <Button variant="primary" className="mt-5 w-full" onClick={join} disabled={busy || !nombre.trim()}>
          {busy ? 'Uniéndote…' : `Unirme a la familia ${invite.fam_name || ''}`}
        </Button>
        <button className="mt-3 block w-full text-center text-xs font-semibold text-leaf" onClick={onCreateOwn}>
          Prefiero crear mi propia familia
        </button>
        <button className="mt-2 block w-full text-center text-xs font-semibold text-ink-soft" onClick={() => void signOut()}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
