import { useEffect, useState } from 'react'
import { hasSupabase, supabase } from '../../lib/supabase'
import { Button } from '../../components/ui'
import { useToast } from '../../components/toastStore'

interface Invite {
  email: string
  label: string | null
}

const FIELD =
  'w-full rounded-[10px] border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-leaf focus:ring-[3px] focus:ring-leaf/15'

/** Gestor de correos invitados. Solo se muestra en modo nube (Supabase configurado). */
export function InvitadosManager() {
  if (!hasSupabase || !supabase) return null
  return <Inner />
}

function Inner() {
  const { toast } = useToast()
  const [list, setList] = useState<Invite[]>([])
  const [email, setEmail] = useState('')
  const [me, setMe] = useState('')

  async function load() {
    const { data } = await supabase!.from('allowed_emails').select('email,label').order('created_at')
    setList((data as Invite[]) ?? [])
  }

  useEffect(() => {
    supabase!.auth.getUser().then(({ data }) => setMe(data.user?.email ?? ''))
    void load()
  }, [])

  async function add() {
    const value = email.trim().toLowerCase()
    if (!value) return
    const { error } = await supabase!.from('allowed_emails').insert({ email: value })
    if (error) toast(error.message, 'warn')
    else {
      setEmail('')
      toast('Invitado agregado ✓', 'ok')
      void load()
    }
  }

  async function remove(e: string) {
    const { error } = await supabase!.from('allowed_emails').delete().eq('email', e)
    if (error) toast(error.message, 'warn')
    else {
      toast('Invitado quitado')
      void load()
    }
  }

  return (
    <>
      <hr className="my-5 border-line" />
      <div className="mt-2 mb-2.5 flex items-center gap-2 font-display text-[15px] font-semibold text-leaf">
        👥 Invitados (quién puede entrar)
      </div>
      <p className="mb-3 text-sm text-ink-soft">
        Solo estos correos pueden iniciar sesión y ver el turno. Agrega a cada apoderado con el
        correo con el que entrará.
      </p>

      <div className="space-y-2">
        {list.map((inv) => (
          <div key={inv.email} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{inv.email}</div>
              {inv.label && <div className="text-[11px] text-ink-soft">{inv.label}</div>}
            </div>
            {inv.email.toLowerCase() === me.toLowerCase() ? (
              <span className="rounded-full bg-panel2 px-2 py-1 text-[11px] font-semibold text-ink-soft">tú</span>
            ) : (
              <Button variant="danger" sm onClick={() => remove(inv.email)}>
                Quitar
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="correo@apoderado.com"
          className={FIELD}
        />
        <Button variant="primary" onClick={add} disabled={!email.trim()}>
          ＋ Invitar
        </Button>
      </div>

      <div className="mt-5 flex items-center justify-between rounded-xl bg-panel2 px-3 py-2.5">
        <span className="text-xs text-ink-soft">
          Sesión: <b className="text-ink">{me || '—'}</b>
        </span>
        <Button variant="ghost" sm onClick={() => supabase!.auth.signOut()}>
          Cerrar sesión
        </Button>
      </div>
    </>
  )
}
