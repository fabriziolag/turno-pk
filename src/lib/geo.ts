import type { Address, Family, School } from './types'

export interface LatLng {
  lat: number
  lng: number
}

/** Distancia en km entre dos puntos (fórmula del haversine). */
export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371
  const toR = (x: number) => (x * Math.PI) / 180
  const dLat = toR(b.lat - a.lat)
  const dLng = toR(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** Primera dirección con coordenadas de una familia (o null). */
export function primaryAddr(f: Family): Address | null {
  return f.addresses.find((a) => a.lat != null) || null
}

const DEFAULT_SCHOOL: LatLng = { lat: -33.386338, lng: -70.600812 }

export function schoolLatLng(school: School): LatLng {
  if (school && school.lat != null && school.lng != null) {
    return { lat: school.lat, lng: school.lng }
  }
  return DEFAULT_SCHOOL
}

/**
 * Orden de entrega. Si hay orden manual, lo respeta; si no, vecino más cercano
 * desde el colegio. El hijo del conductor SIEMPRE queda en la última parada.
 */
export function computeRoute(
  families: Family[],
  driverId: string | null,
  school: School,
  manualOrder: string[] | null,
): Family[] {
  const driver = families.find((f) => f.id === driverId)

  // ---- ORDEN MANUAL (fijado por el usuario) ----
  if (manualOrder && manualOrder.length) {
    const goingIds = new Set(families.map((f) => f.id))
    const ordered: Family[] = manualOrder
      .filter((id) => goingIds.has(id) && id !== driverId)
      .map((id) => families.find((f) => f.id === id))
      .filter((f): f is Family => Boolean(f))
    // familias que van pero no estaban en el orden manual (recién agregadas) → antes del conductor
    families.forEach((f) => {
      if (f.id !== driverId && !manualOrder.includes(f.id)) ordered.push(f)
    })
    if (driver) ordered.push(driver)
    return ordered
  }

  // ---- AUTOMÁTICO (vecino más cercano) ----
  const withGeo = families.filter((f) => primaryAddr(f))
  const noGeo = families.filter((f) => !primaryAddr(f) && f.id !== driverId)
  const driverGeo = withGeo.find((f) => f.id === driverId) || driver
  const others = withGeo.filter((f) => f.id !== driverId)

  // coordenadas de una familia que ya pasó el filtro `withGeo` (lat/lng no nulos)
  const coord = (f: Family): LatLng => {
    const a = primaryAddr(f)!
    return { lat: a.lat!, lng: a.lng! }
  }

  const route: Family[] = []
  let cur: LatLng = schoolLatLng(school)
  const pool = [...others]
  while (pool.length) {
    pool.sort((a, b) => haversine(cur, coord(a)) - haversine(cur, coord(b)))
    const next = pool.shift()!
    route.push(next)
    cur = coord(next)
  }
  noGeo.forEach((f) => route.push(f)) // sin ubicación, listados al final del tramo geográfico
  if (driverGeo) route.push(driverGeo) // conductor siempre último
  return route
}
