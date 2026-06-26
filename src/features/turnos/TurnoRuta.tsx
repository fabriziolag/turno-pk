import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui'
import { useToast } from '../../components/toastStore'
import { addDays, capitalize, dateKey, dayCode, isWeekday, prettyDate, startOfWeek, weekKey } from '../../lib/dates'
import { famColor } from '../../lib/format'
import { haversine } from '../../lib/geo'
import { emptyDoc, loadTurnoDoc, saveTurnoDoc, type TurnoDoc } from '../../lib/turnodoc'
import type { MyTurno, TurnoMemberView } from '../../lib/turnos'

const SANTIAGO = { lat: -33.45, lng: -70.66 }
const GEOFENCE_KM = 0.05 // 50 m

function numberIcon(n: number, color: string, done: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};color:#1a1206;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:13px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);${done ? 'opacity:.4' : ''}">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}
const schoolIcon = (name: string) =>
  L.divIcon({
    className: '',
    html: `<div style="background:#15281c;color:#fff;border-radius:8px;padding:3px 7px;font-size:11px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.3);white-space:nowrap">🏫 ${name}</div>`,
    iconSize: [80, 22],
  })
const vanIcon = L.divIcon({
  className: '',
  html: `<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))">🚐</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
})

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  const key = JSON.stringify(points)
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [40, 40] })
    else if (points.length === 1) map.setView(points[0], 14)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return null
}

export function TurnoRuta({
  turno,
  members,
  myFamilyId,
}: {
  turno: MyTurno
  members: TurnoMemberView[]
  myFamilyId: string | null
}) {
  const { toast } = useToast()
  const [doc, setDoc] = useState<TurnoDoc>(emptyDoc())
  const [anchor, setAnchor] = useState(() => new Date())
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [van, setVan] = useState<{ lat: number; lng: number } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setDoc(await loadTurnoDoc(turno.id))
    } finally {
      setLoading(false)
    }
  }, [turno.id])
  useEffect(() => {
    void load()
  }, [load])

  const wk = weekKey(startOfWeek(anchor))
  const dc = dayCode(anchor)
  const dk = dateKey(anchor)
  const week = doc.schedule[wk]
  const day = week && !week.blocked ? week.days[dc] : undefined
  const confirm = doc.confirm[dk]
  const driverId = confirm?.driver ?? day?.driver ?? null
  const done = doc.routeState[dk]?.done ?? {}

  const kidFamily = useMemo(() => {
    const map = new Map<string, string>()
    members.forEach((m) => m.kids.forEach((k) => map.set(k.id, m.family_id)))
    return map
  }, [members])
  const memberById = useMemo(() => new Map(members.map((m) => [m.family_id, m])), [members])
  const famIndex = useMemo(() => new Map(members.map((m, i) => [m.family_id, i])), [members])

  const school = turno.school_lat != null && turno.school_lng != null ? { lat: turno.school_lat, lng: turno.school_lng } : null

  const goingFamilies = useMemo(() => {
    if (!day) return []
    const goingKids = day.kids.filter((k) => (confirm?.kids[k] ?? 'go') === 'go')
    const famIds = new Set<string>()
    const kidsByFam = new Map<string, string[]>()
    for (const kid of goingKids) {
      const fid = kidFamily.get(kid)
      if (!fid) continue
      famIds.add(fid)
      const m = memberById.get(fid)
      const name = m?.kids.find((k) => k.id === kid)?.name ?? ''
      kidsByFam.set(fid, [...(kidsByFam.get(fid) ?? []), name])
    }
    return [...famIds].map((fid) => ({ m: memberById.get(fid)!, kidNames: kidsByFam.get(fid) ?? [] })).filter((x) => x.m)
  }, [day, confirm, kidFamily, memberById])

  const order = useMemo(() => {
    const start = school ?? SANTIAGO
    const withGeo = goingFamilies.filter((g) => g.m.address?.lat != null && g.m.address?.lng != null)
    const noGeo = goingFamilies.filter((g) => !(g.m.address?.lat != null))
    const others = withGeo.filter((g) => g.m.family_id !== driverId)
    const driver = goingFamilies.find((g) => g.m.family_id === driverId)
    const route: typeof goingFamilies = []
    let cur = start
    const pool = [...others]
    while (pool.length) {
      pool.sort(
        (a, b) =>
          haversine(cur, { lat: a.m.address!.lat!, lng: a.m.address!.lng! }) -
          haversine(cur, { lat: b.m.address!.lat!, lng: b.m.address!.lng! }),
      )
      const next = pool.shift()!
      route.push(next)
      cur = { lat: next.m.address!.lat!, lng: next.m.address!.lng! }
    }
    noGeo.forEach((g) => { if (g.m.family_id !== driverId) route.push(g) })
    if (driver && !route.includes(driver)) route.push(driver)
    return route
  }, [goingFamilies, driverId, school])

  const points: [number, number][] = useMemo(() => {
    const pts: [number, number][] = []
    if (school) pts.push([school.lat, school.lng])
    order.forEach((g) => { if (g.m.address?.lat != null && g.m.address?.lng != null) pts.push([g.m.address.lat, g.m.address.lng]) })
    return pts
  }, [order, school])

  const deliver = useCallback(
    (fid: string, silent = false) => {
      setDoc((cur) => {
        if (cur.routeState[dk]?.done[fid]) return cur
        const next = structuredClone(cur)
        next.routeState[dk] = next.routeState[dk] ?? { done: {} }
        next.routeState[dk].done[fid] = true
        void saveTurnoDoc(turno.id, next).catch(() => {})
        return next
      })
      if (!silent) toast('Entregado ✓', 'ok')
    },
    [dk, turno.id, toast],
  )

  // ---- Realtime Broadcast: posición del furgón en vivo ----
  const channelRef = useRef<RealtimeChannel | null>(null)
  useEffect(() => {
    if (!supabase) return
    const ch = supabase.channel(`pos-${turno.id}`, { config: { broadcast: { self: false } } })
    ch.on('broadcast', { event: 'pos' }, ({ payload }) => {
      const p = payload as { lat: number; lng: number }
      if (typeof p?.lat === 'number') setVan({ lat: p.lat, lng: p.lng })
    }).subscribe()
    channelRef.current = ch
    return () => {
      void supabase?.removeChannel(ch)
      channelRef.current = null
    }
  }, [turno.id])

  // ---- Sondeo del doc para ver entregas en vivo (solo si NO estoy compartiendo) ----
  useEffect(() => {
    if (sharing) return
    const t = setInterval(() => { void loadTurnoDoc(turno.id).then(setDoc) }, 6000)
    return () => clearInterval(t)
  }, [sharing, turno.id])

  // ---- Geocerca: el conductor auto-marca entregado al acercarse ----
  const geofenceRef = useRef<(pos: { lat: number; lng: number }) => void>(() => {})
  geofenceRef.current = (pos) => {
    if (myFamilyId == null || driverId !== myFamilyId) return // solo el conductor
    for (const g of order) {
      const a = g.m.address
      if (a?.lat == null || a?.lng == null) continue
      if (done[g.m.family_id]) continue
      if (haversine(pos, { lat: a.lat, lng: a.lng }) <= GEOFENCE_KM) {
        deliver(g.m.family_id, true)
        toast(`📍 Llegaste a ${g.m.fam_name} — entregado ✓`, 'ok')
      }
    }
  }

  // ---- Compartir mi ubicación ----
  const watchRef = useRef<number | null>(null)
  function toggleShare() {
    if (sharing) {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
      setSharing(false)
      return
    }
    if (!navigator.geolocation) {
      toast('Tu dispositivo no permite ubicación', 'warn')
      return
    }
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude }
        setVan(pos)
        channelRef.current?.send({ type: 'broadcast', event: 'pos', payload: pos })
        geofenceRef.current(pos)
      },
      () => toast('No se pudo obtener tu ubicación (permiso denegado)', 'warn'),
      { enableHighAccuracy: true, maximumAge: 5000 },
    )
    setSharing(true)
  }
  useEffect(() => {
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
    }
  }, [])

  const label = dateKey(anchor) === dateKey(new Date()) ? 'Hoy' : capitalize(prettyDate(anchor))
  const noGeoFams = order.filter((g) => !(g.m.address?.lat != null))
  const iAmDriver = myFamilyId != null && driverId === myFamilyId

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="font-display text-lg font-semibold text-ink">Ruta de entrega</div>
        <div className="flex items-center gap-2 rounded-xl bg-panel2 p-1">
          <button onClick={() => setAnchor(addDays(anchor, -1))} className="grid size-7 place-items-center rounded-lg bg-white text-leaf">‹</button>
          <span className="px-1 text-xs font-semibold">{label}</span>
          <button onClick={() => setAnchor(addDays(anchor, 1))} className="grid size-7 place-items-center rounded-lg bg-white text-leaf">›</button>
        </div>
      </div>

      {!school && (
        <div className="mt-2 rounded-xl border border-gold bg-[#fbf3da] px-3 py-2 text-[12px] text-[#6b551d]">
          📍 Pon la ubicación del <b>colegio</b> en <b>Ajustes</b> para que la ruta parta de ahí.
        </div>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-ink-soft">Cargando…</p>
      ) : !isWeekday(anchor) || !day || order.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-line bg-panel2 px-5 py-10 text-center">
          <div className="text-4xl opacity-60">🗺️</div>
          <p className="mt-2 text-sm text-ink-soft">
            Nada que rutear. Confirma los niños del día en <b>Hoy</b> (y arma el día en <b>Grilla</b>).
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {/* Furgón en vivo */}
          <div className={`flex items-center gap-3 rounded-2xl border p-3 ${sharing ? 'border-leaf bg-leaf/10' : 'border-line bg-white'}`}>
            <div className="flex-1 text-[13px]">
              <div className="font-semibold text-ink">🛰️ Furgón en vivo</div>
              <div className="text-[11.5px] text-ink-soft">
                {sharing
                  ? 'Compartiendo tu ubicación. Mantén la app abierta mientras conduces.'
                  : iAmDriver
                    ? 'Eres el conductor de hoy: comparte tu ubicación para que las familias te sigan y se marque entregado solo al llegar.'
                    : 'El conductor puede compartir su ubicación; aquí verás el furgón moverse en vivo.'}
              </div>
            </div>
            <Button variant={sharing ? 'danger' : 'primary'} sm onClick={toggleShare}>
              {sharing ? 'Detener' : 'Compartir'}
            </Button>
          </div>

          {noGeoFams.length > 0 && (
            <div className="rounded-xl border border-gold bg-[#fbf3da] px-3 py-2 text-[12px] text-[#6b551d]">
              <b>{noGeoFams.map((g) => g.m.fam_name).join(', ')}</b> sin ubicación — no {noGeoFams.length === 1 ? 'aparece' : 'aparecen'} en el mapa. Pon su dirección en <b>Mi familia</b>.
            </div>
          )}

          {school && points.length > 0 && (
            <div className="h-[300px] overflow-hidden rounded-2xl border border-line">
              <MapContainer center={[school.lat, school.lng]} zoom={13} className="h-full w-full" zoomControl>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" maxZoom={19} />
                <Marker position={[school.lat, school.lng]} icon={schoolIcon((turno.school_name || 'Colegio').replace('Colegio ', ''))} />
                {order.map((g, i) => {
                  const a = g.m.address
                  if (a?.lat == null || a?.lng == null) return null
                  const isDrv = g.m.family_id === driverId
                  return (
                    <Marker key={g.m.family_id} position={[a.lat, a.lng]} icon={numberIcon(i + 1, isDrv ? '#c9a84a' : famColor(famIndex.get(g.m.family_id) ?? 0), Boolean(done[g.m.family_id]))}>
                      <Popup>
                        <b>Familia {g.m.fam_name}</b>
                        <br />
                        {g.kidNames.join(', ')}
                        {isDrv && <><br />🚐 conductor (última parada)</>}
                      </Popup>
                    </Marker>
                  )
                })}
                {van && <Marker position={[van.lat, van.lng]} icon={vanIcon} />}
                {points.length > 1 && <Polyline positions={points} pathOptions={{ color: '#2f6d4a', weight: 4, opacity: 0.6, dashArray: '2,8' }} />}
                <FitBounds points={points} />
              </MapContainer>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            {order.map((g, i) => {
              const a = g.m.address
              const isDrv = g.m.family_id === driverId
              const isDone = done[g.m.family_id]
              return (
                <div key={g.m.family_id} className={`flex items-center gap-3 border-b border-line p-3 last:border-0 ${isDone ? 'opacity-50' : ''}`}>
                  <div className={`grid size-7 flex-none place-items-center rounded-full text-sm font-bold ${isDrv ? 'bg-gold text-[#1a1206]' : isDone ? 'bg-[#9fb8a9] text-white' : 'bg-leaf text-white'}`}>
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-ink">Familia {g.m.fam_name} {isDrv ? '🚐' : ''}</div>
                    <div className="truncate text-[11.5px] text-ink-soft">
                      {g.kidNames.join(', ')} · {a?.text || (a?.lat != null ? '' : '⚠ sin ubicación')}
                    </div>
                  </div>
                  <button className="grid size-9 flex-none place-items-center rounded-[10px] bg-[#e6f7ee] text-[#1faa52]" title="Marcar entregado" onClick={() => deliver(g.m.family_id)}>✓</button>
                  <button
                    className="grid size-9 flex-none place-items-center rounded-[10px] bg-[#33ccff] text-[#053] disabled:opacity-40"
                    title="Navegar con Waze"
                    disabled={a?.lat == null}
                    onClick={() => a?.lat != null && window.open(`https://waze.com/ul?ll=${a.lat},${a.lng}&navigate=yes`, '_blank')}
                  >
                    ▸
                  </button>
                </div>
              )
            })}
          </div>
          <p className="text-[11px] text-ink-soft">El orden minimiza el recorrido; el conductor queda al final. Con "Compartir" el furgón se ve en vivo y al llegar a ~50 m de cada casa se marca entregado solo.</p>
        </div>
      )}
    </div>
  )
}
