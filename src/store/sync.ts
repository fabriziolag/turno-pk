import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useStore } from './store'
import type { DB } from '../lib/types'

// Sincroniza el estado del turno con Supabase como documento único JSON
// (tabla turno_state, fila id=1). Doble vía para que la sincronización en vivo
// funcione sí o sí:
//   1) Realtime  → instantáneo cuando está disponible.
//   2) Sondeo 3s → red de seguridad si el realtime no entrega eventos.
// Último-en-escribir gana, suficiente para un furgón de pocas familias.

let channel: RealtimeChannel | null = null
let unsub: (() => void) | null = null
let pollTimer: ReturnType<typeof setInterval> | undefined
let applyingRemote = false
let lastJson = ''
let lastUpdatedAt = ''
let pushTimer: ReturnType<typeof setTimeout> | undefined

async function push(db: DB) {
  if (!supabase) return
  const json = JSON.stringify(db)
  if (json === lastJson) return
  lastJson = json
  const ts = new Date().toISOString()
  lastUpdatedAt = ts // marca propia: el sondeo no la confunde con un cambio ajeno
  await supabase.from('turno_state').upsert({ id: 1, data: db, updated_at: ts })
}

function schedulePush(db: DB) {
  if (applyingRemote) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => void push(db), 600)
}

function applyRemote(incoming: DB, updatedAt?: string) {
  applyingRemote = true
  lastJson = JSON.stringify(incoming)
  if (updatedAt) lastUpdatedAt = updatedAt
  useStore.getState().importDB(incoming)
  applyingRemote = false
}

export async function startSync() {
  if (!supabase || channel) return

  // Autenticar el socket de Realtime con el token del usuario (si no, la RLS le
  // oculta los cambios al socket). Se re-aplica en cada refresco de token.
  const { data: sess } = await supabase.auth.getSession()
  const token = sess.session?.access_token
  if (token) supabase.realtime.setAuth(token)
  supabase.auth.onAuthStateChange((_e, s) => {
    if (s?.access_token) supabase!.realtime.setAuth(s.access_token)
  })

  // 1) Traer el estado remoto (o sembrar con lo local si está vacío)
  const { data } = await supabase
    .from('turno_state')
    .select('data, updated_at')
    .eq('id', 1)
    .maybeSingle()
  const remote = data?.data as DB | undefined
  if (remote && Array.isArray(remote.families)) {
    applyRemote(remote, data?.updated_at as string | undefined)
  } else {
    await push(useStore.getState().db)
  }

  // 2) Realtime: cambios de otros dispositivos al instante (cuando funciona)
  channel = supabase
    .channel('turno_state_sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'turno_state' }, (payload) => {
      const row = payload.new as { data?: DB; updated_at?: string } | null
      const incoming = row?.data
      if (!incoming) return
      if (JSON.stringify(incoming) === lastJson) return // nuestro propio eco
      applyRemote(incoming, row?.updated_at)
    })
    .subscribe()

  // 3) Sondeo de respaldo cada 3s. Pide solo el timestamp (barato) y baja el
  //    documento completo únicamente si cambió respecto a lo que ya tenemos.
  pollTimer = setInterval(() => {
    void (async () => {
      if (!supabase || applyingRemote) return
      const { data: head } = await supabase
        .from('turno_state')
        .select('updated_at')
        .eq('id', 1)
        .maybeSingle()
      const ts = head?.updated_at as string | undefined
      if (!ts || ts === lastUpdatedAt) return
      lastUpdatedAt = ts
      const { data: full } = await supabase
        .from('turno_state')
        .select('data')
        .eq('id', 1)
        .maybeSingle()
      const incoming = full?.data as DB | undefined
      if (incoming && JSON.stringify(incoming) !== lastJson) applyRemote(incoming, ts)
    })()
  }, 3000)

  // 4) Empujar los cambios locales (con rebote para agrupar ediciones rápidas)
  unsub = useStore.subscribe((s) => schedulePush(s.db))
}

export function stopSync() {
  if (channel && supabase) supabase.removeChannel(channel)
  channel = null
  if (unsub) unsub()
  unsub = null
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = undefined
  lastJson = ''
  lastUpdatedAt = ''
}
