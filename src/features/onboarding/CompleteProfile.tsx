import { useMemo, useState } from 'react'
import { Button } from '../../components/ui'
import { REGIONES } from '../../lib/regiones'
import { geocode, parseCoords } from '../../lib/geocode'
import { completeOnboarding, inviteCoParent, signOut } from '../../lib/identity'

const field =
  'w-full rounded-[10px] border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-leaf focus:ring-[3px] focus:ring-leaf/15'
const labelCls = 'mb-1.5 block text-xs font-semibold text-ink'

function RolePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opts = ['padre', 'madre', 'otro']
  return (
    <div className="flex gap-2">
      {opts.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`flex-1 rounded-[10px] border px-3 py-2 text-sm font-semibold capitalize transition ${
            value === o ? 'border-leaf bg-leaf text-white' : 'border-line bg-white text-ink-soft'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

export function CompleteProfile({
  userId,
  email,
  onDone,
}: {
  userId: string
  email: string
  onDone: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [role, setRole] = useState('')
  const [phone, setPhone] = useState('')
  const [famName, setFamName] = useState('')
  const [kids, setKids] = useState<string[]>([''])
  // cónyuge
  const [spNombre, setSpNombre] = useState('')
  const [spApellido, setSpApellido] = useState('')
  const [spEmail, setSpEmail] = useState('')
  // dirección
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
  const canSave = nombre.trim() && apellido.trim() && famName.trim() && cleanKids.length > 0 && text.trim()
  const hasSpouse = spEmail.trim().length > 0

  function onApellido(v: string) {
    setApellido(v)
    if (!famName.trim() || famName === apellido) setFamName(v) // autocompleta apellido familiar
  }

  async function doGeocode() {
    if (!text.trim()) return setGeoMsg('Escribe la dirección primero')
    setGeoMsg('buscando…')
    const r = await geocode(text.trim(), comuna, region)
    if (r) {
      setCoords(r)
      setGeoMsg(`Ubicada ✓ (${r.lat.toFixed(4)}, ${r.lng.toFixed(4)})`)
    } else setGeoMsg('No se pudo ubicar — pega coordenadas o sigue y ubícala después.')
  }
  function pasteCoords() {
    const inp = prompt('Pega coordenadas desde Google Maps (ej: -33.36, -70.53):', '')
    if (inp == null) return
    const r = parseCoords(inp)
    if (r) {
      setCoords(r)
      setGeoMsg(`Coordenadas fijadas ✓ (${r.lat.toFixed(4)}, ${r.lng.toFixed(4)})`)
    } else setGeoMsg('Formato inválido. Debe ser: -33.36, -70.53')
  }

  async function save(sendInvite: boolean) {
    if (!canSave || saving) return
    setSaving(true)
    setErr('')
    try {
      const familyId = await completeOnboarding(userId, {
        nombre,
        apellido,
        role,
        phone,
        famName,
        kids: cleanKids.map((name) => ({ name })),
        address: { text, region, comuna, extra, lat: coords?.lat ?? null, lng: coords?.lng ?? null },
      })
      if (sendInvite && hasSpouse) {
        await inviteCoParent(familyId, spEmail, `${nombre} ${apellido}`.trim(), famName.trim())
      }
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
            <label className={labelCls}>Nombre</label>
            <input className={field} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Fabrizio" />
          </div>
          <div>
            <label className={labelCls}>Apellido</label>
            <input className={field} value={apellido} onChange={(e) => onApellido(e.target.value)} placeholder="Álvarez" />
          </div>
        </div>
        <label className={`${labelCls} mt-3`}>¿Eres…?</label>
        <RolePicker value={role} onChange={setRole} />
        <label className={`${labelCls} mt-3`}>Teléfono (WhatsApp)</label>
        <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+569…" inputMode="tel" />

        <hr className="my-4 border-line" />

        {/* FAMILIA */}
        <div className="mb-2.5 font-display text-[15px] font-semibold text-leaf">👨‍👩‍👧 Tu familia</div>
        <label className={labelCls}>Apellido / familia</label>
        <input className={field} value={famName} onChange={(e) => setFamName(e.target.value)} placeholder="Álvarez" />
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

        {/* CÓNYUGE */}
        <div className="font-display text-[15px] font-semibold text-leaf">👥 El otro padre / madre (opcional)</div>
        <p className="mb-2 mt-1 text-[12px] text-ink-soft">
          Para compartir la familia (también si están separados). Le llegará una invitación cuando entre con su correo.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Nombre</label>
            <input className={field} value={spNombre} onChange={(e) => setSpNombre(e.target.value)} placeholder="María" />
          </div>
          <div>
            <label className={labelCls}>Apellido</label>
            <input className={field} value={spApellido} onChange={(e) => setSpApellido(e.target.value)} placeholder="Pérez" />
          </div>
        </div>
        <label className={`${labelCls} mt-3`}>Correo del otro padre/madre</label>
        <input className={field} type="email" inputMode="email" value={spEmail} onChange={(e) => setSpEmail(e.target.value)} placeholder="correo@ejemplo.com" />

        <hr className="my-4 border-line" />

        {/* DIRECCIÓN */}
        <div className="mb-2.5 font-display text-[15px] font-semibold text-leaf">🏠 Dirección de la casa</div>
        <label className={labelCls}>Dirección</label>
        <input className={field} value={text} onChange={(e) => setText(e.target.value)} placeholder="Camino del Fundador 12973" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Región</label>
            <select className={field} value={region} onChange={(e) => { setRegion(e.target.value); setComuna('') }}>
              <option value="">— Región —</option>
              {Object.keys(REGIONES).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Comuna</label>
            <select className={field} value={comuna} onChange={(e) => setComuna(e.target.value)}>
              <option value="">— Comuna —</option>
              {comunas.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <label className={`${labelCls} mt-3`}>Otros datos (opcional)</label>
        <input className={field} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Casa T / portón verde" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant="ghost" sm onClick={doGeocode}>🔎 Ubicar en el mapa</Button>
          <Button variant="ghost" sm onClick={pasteCoords}>📋 Pegar coordenadas</Button>
          {geoMsg && <span className="text-[11px] text-ink-soft">{geoMsg}</span>}
        </div>

        {err && <p className="mt-4 text-xs text-clay">{err}</p>}

        <div className="mt-5 flex flex-col gap-2">
          <Button variant="primary" className="w-full" onClick={() => save(false)} disabled={!canSave || saving}>
            {saving ? 'Guardando…' : 'Guardar y entrar'}
          </Button>
          {hasSpouse && (
            <Button variant="gold" className="w-full" onClick={() => save(true)} disabled={!canSave || saving}>
              {saving ? 'Guardando…' : `Guardar y enviar invitación a ${spEmail.trim()}`}
            </Button>
          )}
        </div>
        <button className="mt-3 block w-full text-center text-xs font-semibold text-ink-soft" onClick={() => void signOut()}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
