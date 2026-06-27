// Edge Function: notify — envía Web Push a los apoderados de una familia.
// Llamada por un miembro del turno (p.ej. al marcar entregado).
// Secretos a configurar en Supabase → Edge Functions → Secrets:
//   VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT (ej: mailto:tucorreo@ejemplo.com)
// (SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase.)
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { familyId, title, body, url } = await req.json()
    if (!familyId) return json({ error: 'familyId requerido' }, 400)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    // 1) Verificar que quien llama comparte un turno con esa familia (RLS como el usuario)
    const caller = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } })
    const { data: allowed, error: rpcErr } = await caller.rpc('shares_turno_with_family', { fam: familyId })
    if (rpcErr) return json({ error: rpcErr.message }, 400)
    if (!allowed) return json({ error: 'no autorizado' }, 403)

    // 2) Buscar suscripciones de los apoderados de esa familia (service_role, salta RLS)
    const admin = createClient(SUPABASE_URL, SERVICE)
    const { data: members } = await admin.from('family_members').select('profile_id').eq('family_id', familyId)
    const ids = (members ?? []).map((m: { profile_id: string }) => m.profile_id)
    if (!ids.length) return json({ sent: 0 })
    const { data: subs } = await admin.from('push_subscriptions').select('*').in('profile_id', ids)

    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') || 'mailto:turnopk@example.com',
      Deno.env.get('VAPID_PUBLIC')!,
      Deno.env.get('VAPID_PRIVATE')!,
    )
    const payload = JSON.stringify({ title: title || 'Turno PK', body: body || '', url: url || '/' })

    let sent = 0
    await Promise.all(
      (subs ?? []).map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          )
          sent++
        } catch (e) {
          // suscripción muerta (410/404) → borrarla
          const code = (e as { statusCode?: number }).statusCode
          if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id)
        }
      }),
    )
    return json({ sent })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'error' }, 500)
  }
})

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
