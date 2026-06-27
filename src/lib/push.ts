// Suscripción a notificaciones push (Web Push) desde el cliente.
import { supabase } from './supabase'

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC as string | undefined

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export type PushResult = 'ok' | 'denied' | 'unsupported' | 'noconfig' | 'error'

/** Pide permiso, se suscribe y guarda la suscripción en Supabase. */
export async function enablePush(userId: string): Promise<PushResult> {
  if (!pushSupported()) return 'unsupported'
  if (!VAPID_PUBLIC) return 'noconfig'
  if (!supabase) return 'error'
  try {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return 'denied'
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      })
    }
    const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } }
    if (!j.endpoint || !j.keys) return 'error'
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        { profile_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth },
        { onConflict: 'endpoint' },
      )
    if (error) return 'error'
    return 'ok'
  } catch {
    return 'error'
  }
}

export async function isPushOn(): Promise<boolean> {
  if (!pushSupported()) return false
  try {
    const reg = await navigator.serviceWorker.ready
    return Boolean(await reg.pushManager.getSubscription())
  } catch {
    return false
  }
}

/** Notifica a una familia (vía Edge Function). Devuelve un diagnóstico legible. */
export async function notifyFamily(
  familyId: string,
  title: string,
  body: string,
  url = '/',
): Promise<{ ok: boolean; info: string }> {
  if (!supabase) return { ok: false, info: 'sin Supabase' }
  try {
    const { data, error } = await supabase.functions.invoke('bright-endpoint', {
      body: { familyId, title, body, url },
    })
    if (error) {
      let detail = error.message ?? 'error función'
      try {
        const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context
        if (ctx?.json) detail = JSON.stringify(await ctx.json())
      } catch {
        /* sin cuerpo */
      }
      return { ok: false, info: detail }
    }
    return { ok: true, info: typeof data === 'object' ? JSON.stringify(data) : String(data) }
  } catch (e) {
    return { ok: false, info: e instanceof Error ? e.message : 'error' }
  }
}
