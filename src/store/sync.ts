import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useStore } from './store'
import type { DB } from '../lib/types'

// Sincroniza el estado del turno con Supabase como documento único JSON
// (tabla turno_state, fila id=1) + realtime. Último-en-escribir gana, que es
// suficiente para un furgón de pocas familias.

let channel: RealtimeChannel | null = null
let unsub: (() => void) | null = null
let applyingRemote = false
let lastJson = ''
let pushTimer: ReturnType<typeof setTimeout> | undefined

async function push(db: DB) {
  if (!supabase) return
  const json = JSON.stringify(db)
  if (json === lastJson) return
  lastJson = json
  await supabase.from('turno_state').upsert({ id: 1, data: db, updated_at: new Date().toISOString() })
}

function schedulePush(db: DB) {
  if (applyingRemote) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => void push(db), 600)
}

function applyRemote(incoming: DB) {
  applyingRemote = true
  lastJson = JSON.stringify(incoming)
  useStore.getState().importDB(incoming)
  applyingRemote = false
}

export async function startSync() {
  if (!supabase || channel) return

  // 0) Autenticar el socket de Realtime con el token del usuario. Sin esto, el
  //    canal sale como anónimo y la RLS le oculta los cambios (se ven solo al
  //    recargar). Se re-aplica en cada refresco de token.
  const { data: sess } = await supabase.auth.getSession()
  const token = sess.session?.access_token
  if (token) supabase.realtime.setAuth(token)
  supabase.auth.onAuthStateChange((_e, s) => {
    if (s?.access_token) supabase!.realtime.setAuth(s.access_token)
  })

  // 1) Traer el estado remoto (o sembrar con lo local si está vacío)
  const { data } = await supabase.from('turno_state').select('data').eq('id', 1).maybeSingle()
  const remote = data?.data as DB | undefined
  if (remote && Array.isArray(remote.families)) {
    applyRemote(remote)
  } else {
    await push(useStore.getState().db)
  }

  // 2) Escuchar cambios de otros dispositivos
  channel = supabase
    .channel('turno_state_sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'turno_state' }, (payload) => {
      const incoming = (payload.new as { data?: DB } | null)?.data
      if (!incoming) return
      if (JSON.stringify(incoming) === lastJson) return // nuestro propio eco
      applyRemote(incoming)
    })
    .subscribe()

  // 3) Empujar los cambios locales (con rebote para agrupar ediciones rápidas)
  unsub = useStore.subscribe((s) => schedulePush(s.db))
}

export function stopSync() {
  if (channel && supabase) supabase.removeChannel(channel)
  channel = null
  if (unsub) unsub()
  unsub = null
  lastJson = ''
}
