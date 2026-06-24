import { useMemo, useState } from 'react'
import { Button } from '../../components/ui'
import { REGIONES } from '../../lib/regiones'
import { geocode, parseCoords } from '../../lib/geocode'
import { completeOnboarding, signOut } from '../../lib/identity'

const field =
  'w-full rounded-[10px] border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-leaf focus:ring-[3px] focus:ring-leaf/15'
const labelCls = 'mb-1.5 block text-xs font-semibold text-ink'

export function CompleteProfile({
  userId,
  email,
  onDone,
}: {
  userId: string
  email: string
  onDone: () => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [famName, setFamName] = useState('')
  const [kids, setKids] = useState<string[]>([''])
  const [text, setText] = useState('')
  const [region, setRegion] = useState('')
  const [comuna, setComuna] = useState('')
  const [extra, setExtra] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [geoMsg, setGeoMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const comunas = useMemo(() => (region && REGIONES[region]) || [], [region])
  const cleanKids = kids.map((k) => k.trim()).filter(Boolean)
  const canSave = name.trim() && famName.trim() && cleanKids.length > 0 && text.trim()

  async function doGeocode() {
    if (!text.trim()) {
      setGeoMsg('Escribe la dirección primero')
      return
    }
    setGeoMsg('buscando…')
    const r = await geocode(text.trim(), comuna, region)
    if (r) {
      setCoords(r)
      setGeoMsg(`Ubicada ✓ (${r.lat.toFixed(4)}, ${r.lng.toFixed(4)})`)
    } else {
      setGeoMsg('No se pudo ubicar — puedes pegar coordenadas o seguir y ubicarla después.')
    }
  }
  function pasteCoords() {
    const inp = prompt('Pega las coordenadas desde Google Maps (ej: -33.36, -70.53):', '')
    if (inp == null) return
    const r = parseCoords(inp)
    if (r) {
      setCoords(r)
      setGeoMsg(`Coordenadas fijadas ✓ (${r.lat.toFixed(4)}, ${r.lng.toFixed(4)})`)
    } else setGeoMsg('Formato inválido. Debe ser: -33.36, -70.53')
  }

  async function save() {
    if (!canSave || saving) return
    setSaving(true)
    setErr('')
    try {
      await completeOnboarding(userId, {
        name,
        phone,
        famName,
        kids: cleanKids.map((name) => ({ name })),
        address: { text, region, comuna, extra, lat: coords?.lat ?? null, lng: coords?.lng ?? null },
      })
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo guardar. Intenta de nuevo.')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-dvh px-4 py-8">
      <div className="mx-auto w-full max-w-lg rounded-3xl bg-panel p-6 shadow-2xl shadow-black/30">
        <div className="mb-1 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-gold to-gold-deep text-xl shadow-lg shadow-gold/30">
            🚐
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold leading-none text-ink">Bienvenido a Turno PK</h1>
            <div className="mt-1 text-[11.5px] text-ink-soft">{email}</div>
          </div>
        </div>
        <p className="mb-5 mt-3 text-sm text-ink-soft">
          Completa tu perfil para empezar. Con esto se desbloquea crear e invitar a tu turno.
        </p>

        {/* TÚ */}
        <div className="mb-2.5 font-display text-[15px] font-semibold text-leaf">👤 Tú (apoderado)</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Tu nombre</label>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Fabrizio Álvarez" />
          </div>
          <div>
            <label className={labelCls}>Teléfono (WhatsApp)</label>
            <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+569…" inputMode="tel" />
          </div>
        </div>

        <hr className="my-4 border-line" />

        {/* FAMILIA */}
        <div className="mb-2.5 font-display text-[15px] font-semibold text-leaf">👨‍👩‍👧 Tu familia</div>
        <label className={labelCls}>Apellido / familia</label>
        <input className={field} value={famName} onChange={(e) => setFamName(e.target.value)} placeholder="Ej: Álvarez" />

        <label className={`${labelCls} mt-3`}>Hijos</label>
        <div className="space-y-2">
          {kids.map((k, i) => (
            <div key={i} className="flex gap-2">
              <input
                className={field}
                value={k}
                onChange={(e) => setKids((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={`Nombre del hijo/a ${i + 1}`}
              />
              {kids.length > 1 && (
                <Button variant="danger" sm onClick={() => setKids((prev) => prev.filter((_, j) => j !== i))}>
                  ✕
                </Button>
              )}
            </div>
          ))}
        </div>
        <button className="mt-2 text-xs font-semibold text-leaf" onClick={() => setKids((p) => [...p, ''])}>
          ➕ Agregar otro hijo
        </button>

        <hr className="my-4 border-line" />

        {/* DIRECCIÓN */}
        <div className="mb-2.5 font-display text-[15px] font-semibold text-leaf">🏠 Dirección de la casa</div>
        <label className={labelCls}>Dirección</label>
        <input className={field} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ej: Camino del Fundador 12973" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Región</label>
            <select
              className={field}
              value={region}
              onChange={(e) => {
                setRegion(e.target.value)
                setComuna('')
              }}
            >
              <option value="">— Región —</option>
              {Object.keys(REGIONES).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Comuna</label>
            <select className={field} value={comuna} onChange={(e) => setComuna(e.target.value)}>
              <option value="">— Comuna —</option>
              {comunas.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className={`${labelCls} mt-3`}>Otros datos (opcional)</label>
        <input className={field} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Ej: Casa T / portón verde" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant="ghost" sm onClick={doGeocode}>
            🔎 Ubicar en el mapa
          </Button>
          <Button variant="ghost" sm onClick={pasteCoords}>
            📋 Pegar coordenadas
          </Button>
          {geoMsg && <span className="text-[11px] text-ink-soft">{geoMsg}</span>}
        </div>

        {err && <p className="mt-4 text-xs text-clay">{err}</p>}

        <Button variant="primary" className="mt-5 w-full" onClick={save} disabled={!canSave || saving}>
          {saving ? 'Guardando…' : 'Guardar y entrar'}
        </Button>
        <button className="mt-3 block w-full text-center text-xs font-semibold text-ink-soft" onClick={() => void signOut()}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
