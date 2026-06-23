export interface GeoResult {
  lat: number
  lng: number
}

/**
 * Geocodifica una dirección en Chile con OpenStreetMap Nominatim (gratis).
 * Prueba variantes de la más específica a la más general. Devuelve null si no encuentra.
 */
export async function geocode(
  text: string,
  comuna?: string,
  region?: string,
): Promise<GeoResult | null> {
  const variants: string[] = []
  if (comuna) variants.push(`${text}, ${comuna}, Chile`)
  if (comuna && region) variants.push(`${text}, ${comuna}, ${region}, Chile`)
  variants.push(`${text}, Santiago, Chile`, `${text}, Chile`)

  for (const v of variants) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=cl&q=${encodeURIComponent(v)}`
      const r = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!r.ok) continue
      const j = (await r.json()) as Array<{ lat: string; lon: string }>
      if (Array.isArray(j) && j.length) {
        return { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon) }
      }
    } catch {
      /* probar siguiente variante */
    }
  }
  return null
}

/** Parsea "lat, lng" pegado desde Google Maps. Devuelve null si es inválido. */
export function parseCoords(input: string): GeoResult | null {
  const m = input
    .replace(/[()]/g, '')
    .split(',')
    .map((s) => parseFloat(s.trim()))
  if (m.length === 2 && !isNaN(m[0]) && !isNaN(m[1]) && Math.abs(m[0]) <= 90 && Math.abs(m[1]) <= 180) {
    return { lat: m[0], lng: m[1] }
  }
  return null
}
