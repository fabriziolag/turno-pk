import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { hasSupabase, supabase } from '../../lib/supabase'
import { startSync, stopSync } from '../../store/sync'
import { Button } from '../../components/ui'

/** Envuelve la app. Sin Supabase configurado → modo local (sin login). */
export function AuthGate({ children }: { children: ReactNode }) {
  if (!hasSupabase || !supabase) return <>{children}</>
  return <AuthGateCloud>{children}</AuthGateCloud>
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-sm rounded-3xl bg-panel p-7 shadow-2xl shadow-black/30">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-gold to-gold-deep text-xl shadow-lg shadow-gold/30">
            🚐
          </div>
          <div>
            <div className="font-display text-lg font-semibold leading-none text-ink">Turno PK</div>
            <div className="mt-1 text-[11.5px] text-ink-soft">Furgón compartido</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function AuthGateCloud({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [member, setMember] = useState<boolean | null>(null)

  useEffect(() => {
    supabase!.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase!.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    let active = true
    if (!session) {
      setMember(null)
      stopSync()
      return
    }
    supabase!.rpc('is_member').then(({ data }) => {
      if (!active) return
      const ok = Boolean(data)
      setMember(ok)
      if (ok) void startSync()
    })
    return () => {
      active = false
    }
  }, [session])

  if (!ready) return <Splash />
  if (!session) return <Login />
  if (member === null) return <Splash />
  if (!member) return <NotInvited email={session.user.email ?? ''} />
  return <>{children}</>
}

function Splash() {
  return (
    <Shell>
      <p className="text-sm text-ink-soft">Cargando…</p>
    </Shell>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')

  async function send() {
    const value = email.trim()
    if (!value) return
    setSending(true)
    setErr('')
    const { error } = await supabase!.auth.signInWithOtp({
      email: value,
      options: { emailRedirectTo: window.location.origin },
    })
    setSending(false)
    if (error) setErr(error.message)
    else setSent(true)
  }

  async function signInWithGoogle() {
    setErr('')
    const { error } = await supabase!.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setErr(error.message)
  }

  if (sent) {
    return (
      <Shell>
        <h2 className="font-display text-xl font-semibold text-ink">Revisa tu correo 📬</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Te enviamos un enlace mágico a <b>{email.trim()}</b>. Ábrelo desde este mismo dispositivo
          para entrar. (Revisa también spam.)
        </p>
        <button className="mt-4 text-xs font-semibold text-leaf" onClick={() => setSent(false)}>
          ← Usar otro correo
        </button>
      </Shell>
    )
  }

  return (
    <Shell>
      <h2 className="font-display text-xl font-semibold text-ink">Entrar al turno</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Entra con Google o con un enlace a tu correo. Solo correos invitados pueden entrar.
      </p>

      <button
        onClick={signInWithGoogle}
        className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-[10px] border border-line bg-white px-3 py-2.5 text-sm font-semibold text-ink transition hover:bg-panel2"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
        </svg>
        Entrar con Google
      </button>

      <div className="my-4 flex items-center gap-3 text-[11px] text-ink-soft">
        <span className="h-px flex-1 bg-line" />o con tu correo<span className="h-px flex-1 bg-line" />
      </div>

      <label className="mb-1.5 block text-xs font-semibold text-ink">Tu correo</label>
      <input
        type="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && send()}
        placeholder="correo@ejemplo.com"
        className="w-full rounded-[10px] border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-leaf focus:ring-[3px] focus:ring-leaf/15"
      />
      {err && <p className="mt-2 text-xs text-clay">{err}</p>}
      <Button variant="primary" className="mt-4 w-full" onClick={send} disabled={sending || !email.trim()}>
        {sending ? 'Enviando…' : 'Enviarme el enlace'}
      </Button>
    </Shell>
  )
}

function NotInvited({ email }: { email: string }) {
  return (
    <Shell>
      <h2 className="font-display text-xl font-semibold text-ink">Aún no estás invitado 🔒</h2>
      <p className="mt-2 text-sm text-ink-soft">
        El correo <b>{email}</b> no está en la lista del turno. Pídele al organizador que te agregue
        desde <b>Ajustes → Invitados</b>.
      </p>
      <Button variant="ghost" className="mt-4 w-full" onClick={() => supabase!.auth.signOut()}>
        Salir
      </Button>
    </Shell>
  )
}
