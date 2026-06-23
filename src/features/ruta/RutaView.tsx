import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useStore } from '../../store/store'
import { useView } from '../../store/view'
import { useToast } from '../../components/toastStore'
import { Button } from '../../components/ui'
import { dateKey, dayCode, startOfWeek, weekKey } from '../../lib/dates'
import { famColor, driverShort } from '../../lib/format'
import { computeRoute, primaryAddr, schoolLatLng } from '../../lib/geo'
import { goingKids, waDelivered } from '../../lib/share'
import type { Family } from '../../lib/types'

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

export function RutaView() {
  const db = useStore((s) => s.db)
  const markDelivered = useStore((s) => s.markDelivered)
  const setManualOrder = useStore((s) => s.setManualOrder)
  const { toast } = useToast()
  const d = useView((s) => s.hoyAnchor)

  const dk = dateKey(d)
  const wk = weekKey(startOfWeek(d))
  const W = db.schedule[wk]
  const dc = dayCode(d)
  const day = (W && !W.blocked && W.days[dc]) || { kids: [], driver: null }
  const C = db.confirm[dk]
  const driverId = C?.driver ?? day.driver
  const driverParent = C?.driverParent ?? 0

  const getFamily = (id: string) => db.families.find((f) => f.id === id)
  const driverFam = driverId ? getFamily(driverId) : undefined

  const going = useMemo(
    () =>
      goingKids(day, C ?? { kids: {}, picked: {}, driver: driverId, driverParent })
        .map(getFamily)
        .filter((f): f is Family => Boolean(f)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db.families, db.confirm, db.schedule, dk, wk, dc],
  )

  const order = computeRoute(going, driverId, db.school, db.manualOrder)
  const done = db.routeState[dk]?.done ?? {}
  const noGeoKids = going.filter((f) => !primaryAddr(f))

  const school = schoolLatLng(db.school)
  const points: [number, number][] = [
    [school.lat, school.lng],
    ...order
      .map((f) => primaryAddr(f))
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
      .map((a) => [a!.lat!, a!.lng!] as [number, number]),
  ]

  function moveInOrder(id: string, dir: number) {
    let base = (db.manualOrder ? db.manualOrder.slice() : order.map((f) => f.id))
    db.families.forEach((f) => {
      if (!base.includes(f.id)) base.push(f.id)
    })
    base = base.filter((x) => x !== driverId)
    const i = base.indexOf(id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= base.length) return
    ;[base[i], base[j]] = [base[j], base[i]]
    setManualOrder(driverId && !base.includes(driverId) ? base.concat(driverId) : base)
    toast('Orden actualizado ✓', 'ok')
  }

  function deliver(f: Family) {
    markDelivered(dk, f.id)
    waDelivered(f)
    toast(`${f.kidName} marcado como entregado ✓`, 'ok')
  }

  return (
    <section>
      <h2 className="font-display text-2xl font-semibold text-ink">Ruta de entrega</h2>
      <p className="mt-1 text-sm text-ink-soft">
        El orden minimiza el recorrido. <b>El hijo del conductor de turno queda al final.</b> Toca una
        parada para marcarla como entregada o navegar con Waze.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <Button variant="primary" sm onClick={() => toast('Ruta recalculada ✓', 'ok')}>
          ↻ Recalcular ruta
        </Button>
        <span className="rounded-full bg-panel2 px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
          Retira: {driverId ? driverShort(driverFam, driverParent) : '—'}
        </span>
      </div>

      {going.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line bg-panel2 px-6 py-16 text-center">
          <div className="text-5xl opacity-50">🗺</div>
          <p className="mt-3 font-display text-lg text-ink">Nada que rutear</p>
          <p className="mt-1 text-sm text-ink-soft">
            Confirma los niños del día en la pestaña <b>Hoy</b>.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
          {/* Lista */}
          <div className="max-h-[440px] overflow-y-auto rounded-2xl border border-line bg-white p-2">
            {noGeoKids.length > 0 && (
              <div className="mb-2.5 flex items-start gap-2 rounded-xl border border-gold bg-[#fbf3da] px-3 py-2.5 text-[12px] text-[#6b551d]">
                <span>📍</span>
                <div>
                  <b>{noGeoKids.map((f) => f.kidName).join(', ')}</b> sin ubicación, no {noGeoKids.length === 1 ? 'aparece' : 'aparecen'} en el mapa. Ve a <b>Familias → Editar</b>.
                </div>
              </div>
            )}

            <div className={`mb-1.5 flex items-center gap-2 rounded-[10px] px-3 py-2.5 text-xs ${db.manualOrder ? 'bg-[#eef5ee]' : 'bg-[#faf6e8]'}`}>
              <span className={`font-semibold ${db.manualOrder ? 'text-leaf' : 'text-gold-deep'}`}>
                {db.manualOrder ? '📌 Orden manual fijo' : '🔄 Orden automático (más cercano)'}
              </span>
              {db.manualOrder ? (
                <button
                  className="ml-auto rounded-lg bg-panel2 px-2 py-1 font-semibold text-ink"
                  onClick={() => {
                    setManualOrder(null)
                    toast('Volviste al orden automático', 'ok')
                  }}
                >
                  Volver a automático
                </button>
              ) : (
                <span className="ml-auto text-ink-soft">Usa ↑↓ para fijar tu orden</span>
              )}
            </div>

            {order.map((f, i) => {
              const a = primaryAddr(f)
              const isDrv = f.id === driverId
              const isDone = done[f.id]
              return (
                <div key={f.id} className={`flex items-center gap-3 rounded-xl p-3 ${isDone ? 'opacity-50' : ''} ${i < order.length - 1 ? 'border-b border-line' : ''}`}>
                  <div className={`grid size-[30px] flex-none place-items-center rounded-full text-sm font-bold ${isDrv ? 'bg-gold text-[#1a1206]' : isDone ? 'bg-[#9fb8a9] text-white' : 'bg-leaf text-white'}`}>
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">
                      {f.kidName} {isDrv ? '🚐' : ''}
                    </div>
                    <div className="truncate text-[11.5px] text-ink-soft">
                      {a?.text || ''} {!a && <span className="text-clay">⚠ sin ubicación</span>}
                    </div>
                  </div>
                  <div className="flex flex-none gap-1.5">
                    {!isDrv && (
                      <>
                        <button className="grid size-9 place-items-center rounded-[10px] bg-[#eef0e8] text-leaf" title="Subir" onClick={() => moveInOrder(f.id, -1)}>
                          ↑
                        </button>
                        <button className="grid size-9 place-items-center rounded-[10px] bg-[#eef0e8] text-leaf" title="Bajar" onClick={() => moveInOrder(f.id, 1)}>
                          ↓
                        </button>
                      </>
                    )}
                    <button className="grid size-9 place-items-center rounded-[10px] bg-[#e6f7ee] text-[#1faa52]" title="Marcar entregado + avisar" onClick={() => deliver(f)}>
                      ✓
                    </button>
                    <button
                      className="grid size-9 place-items-center rounded-[10px] bg-[#33ccff] text-[#053] disabled:opacity-40"
                      title="Navegar con Waze"
                      disabled={!a}
                      onClick={() => a && window.open(`https://waze.com/ul?ll=${a.lat},${a.lng}&navigate=yes`, '_blank')}
                    >
                      ▸
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Mapa */}
          <div className="h-[440px] overflow-hidden rounded-2xl border border-line">
            <MapContainer center={[school.lat, school.lng]} zoom={13} className="h-full w-full" zoomControl>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" maxZoom={19} />
              <Marker position={[school.lat, school.lng]} icon={schoolIcon((db.school.name || 'Colegio').replace('Colegio ', ''))} />
              {order.map((f, i) => {
                const a = primaryAddr(f)
                if (!a) return null
                const isDrv = f.id === driverId
                return (
                  <Marker key={f.id} position={[a.lat!, a.lng!]} icon={numberIcon(i + 1, isDrv ? '#c9a84a' : famColor(db.families.indexOf(f)), Boolean(done[f.id]))}>
                    <Popup>
                      <b>{f.kidName}</b>
                      <br />
                      {a.text || ''}
                      {isDrv && (
                        <>
                          <br />🚐 conductor (última parada)
                        </>
                      )}
                    </Popup>
                  </Marker>
                )
              })}
              {points.length > 1 && <Polyline positions={points} pathOptions={{ color: '#2f6d4a', weight: 4, opacity: 0.6, dashArray: '2,8' }} />}
              <FitBounds points={points} />
            </MapContainer>
          </div>
        </div>
      )}
    </section>
  )
}
