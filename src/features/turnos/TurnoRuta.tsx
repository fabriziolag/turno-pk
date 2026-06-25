import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useToast } from '../../components/toastStore'
import { addDays, capitalize, dateKey, dayCode, isWeekday, prettyDate, startOfWeek, weekKey } from '../../lib/dates'
import { famColor } from '../../lib/format'
import { haversine } from '../../lib/geo'
import { emptyDoc, loadTurnoDoc, saveTurnoDoc, type TurnoDoc } from '../../lib/turnodoc'
import type { MyTurno, TurnoMemberView } from '../../lib/turnos'

const SANTIAGO = { lat: -33.45, lng: -70.66 }

function numberIcon(n: number, color: string, done: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};color:#1a1206;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:13px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);${done ? 'opacity:.4' : ''}">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}
function schoolIcon(name: string) {
  return L.divIcon({
    className: '',
    html: `<div style="background:#15281c;color:#fff;border-radius:8px;padding:3px 7px;font-size:11px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.3);white-space:nowrap">🏫 ${name}</div>`,
    iconSize: [80, 22],
  })
}
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

export function TurnoRuta({ turno, members }: { turno: MyTurno; members: TurnoMemberView[] }) {
  const { toast } = useToast()
  const [doc, setDoc] = useState<TurnoDoc>(emptyDoc())
  const [anchor, setAnchor] = useState(() => new Date())
  const [loading, setLoading] = useState(true)

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

  // familias con ≥1 hijo que va hoy
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

  // orden: vecino más cercano desde el colegio, conductor último
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

  async function persist(next: TurnoDoc) {
    setDoc(next)
    try {
      await saveTurnoDoc(turno.id, next)
    } catch {
      toast('No se pudo guardar', 'warn')
    }
  }
  function deliver(fid: string) {
    const next = structuredClone(doc)
    next.routeState[dk] = next.routeState[dk] ?? { done: {} }
    next.routeState[dk].done[fid] = !next.routeState[dk].done[fid]
    void persist(next)
  }

  const label = dateKey(anchor) === dateKey(new Date()) ? 'Hoy' : capitalize(prettyDate(anchor))
  const noGeoFams = order.filter((g) => !(g.m.address?.lat != null))

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
                {points.length > 1 && <Polyline positions={points} pathOptions={{ color: '#2f6d4a', weight: 4, opacity: 0.6, dashArray: '2,8' }} />}
                <FitBounds points={points} />
              </MapContainer>
            </div>
          )}

          {/* Lista de paradas */}
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
                    <div className="text-sm font-semibold text-ink">
                      Familia {g.m.fam_name} {isDrv ? '🚐' : ''}
                    </div>
                    <div className="truncate text-[11.5px] text-ink-soft">
                      {g.kidNames.join(', ')} · {a?.text || (a?.lat != null ? '' : '⚠ sin ubicación')}
                    </div>
                  </div>
                  <button className="grid size-9 flex-none place-items-center rounded-[10px] bg-[#e6f7ee] text-[#1faa52]" title="Marcar entregado" onClick={() => deliver(g.m.family_id)}>
                    ✓
                  </button>
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
          <p className="text-[11px] text-ink-soft">El orden minimiza el recorrido; el conductor queda al final. ✓ marca entregado, ▸ abre Waze.</p>
        </div>
      )}
    </div>
  )
}
