import { useMemo, useState } from 'react'
import { Button } from '../../components/ui'
import { useToast } from '../../components/toastStore'
import { REGIONES } from '../../lib/regiones'
import { geocode, parseCoords } from '../../lib/geocode'
import {
  addKid,
  inviteCoParent,
  removeKid,
  renameKid,
  updateFamilyName,
  updateMe,
  upsertAddress,
  type MyContext,
} from '../../lib/identity'

const field =
  'w-full rounded-[10px] border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-leaf focus:ring-[3px] focus:ring-leaf/15'
const labelCls = 'mb-1.5 block text-xs font-semibold text-ink'
const sectionCls = 'rounded-3xl bg-panel p-5 shadow-2xl shadow-black/30'
const headCls = 'mb-3 font-display text-[15px] font-semibold text-leaf'

function RolePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      {['padre', 'madre', 'otro'].map((o) => (
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

export function MiFamilia({
  ctx,
  onBack,
  onChanged,
}: {
  ctx: MyContext
  onBack: () => void
  onChanged: () => void
}) {
  const { profile, family, kids, addresses, coParents, myRole } = ctx
  const { toast } = useToast()

  // perfil
  const [nombre, setNombre] = useState(profile.name)
  const [apellido, setApellido] = useState(profile.apellido)
  const [phone, setPhone] = useState(profile.phone)
  const [role, setRole] = useState(myRole)
  // familia
  const [famName, setFamName] = useState(family?.fam_name ?? '')
  // hijos (editable local)
  const [kidsLocal, setKidsLocal] = useState(kids.map((k) => ({ id: k.id, name: k.name })))
  // dirección
  const addr = addresses[0]
  const [text, setText] = useState(addr?.text ?? '')
  const [region, setRegion] = useState(addr?.region ?? '')
  const [comuna, setComuna] = useState(addr?.comuna ?? '')
  const [extra, setExtra] = useState(addr?.extra ?? '')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    addr?.lat != null && addr?.lng != null ? { lat: addr.lat, lng: addr.lng } : null,
  )
  const [geoMsg, setGeoMsg] = useState('')
  // co-apoderado
  const [coName, setCoName] = useState('')
  const [coApellido, setCoApellido] = useState('')
  const [coEmail, setCoEmail] = useState('')

  const comunas = useMemo(() => (region && REGIONES[region]) || [], [region])

  async function run(fn: () => Promise<void>, ok: string) {
    try {
      await fn()
      toast(ok, 'ok')
      onChanged()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'warn')
    }
  }

  async function doGeocode() {
    if (!text.trim()) return setGeoMsg('Escribe la dirección primero')
    setGeoMsg('buscando…')
    const r = await geocode(text.trim(), comuna, region)
    if (r) {
      setCoords(r)
      setGeoMsg(`Ubicada ✓`)
    } else setGeoMsg('No se pudo ubicar — pega coordenadas.')
  }
  function pasteCoords() {
    const inp = prompt('Pega coordenadas (ej: -33.36, -70.53):', '')
    if (inp == null) return
    const r = parseCoords(inp)
    if (r) {
      setCoords(r)
      setGeoMsg('Coordenadas fijadas ✓')
    } else setGeoMsg('Formato inválido')
  }

  async function saveKids() {
    if (!family) return
    try {
      let sort = 0
      for (const k of kidsLocal) {
        const orig = kids.find((o) => o.id === k.id)
        if (k.id && orig && orig.name !== k.name.trim() && k.name.trim()) await renameKid(k.id, k.name)
        if (!k.id && k.name.trim()) await addKid(family.id, k.name, sort)
        sort++
      }
      toast('Hijos guardados ✓', 'ok')
      onChanged()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'warn')
    }
  }

  if (!family) {
    return (
      <div className="grid min-h-dvh place-items-center px-5 text-emerald-200/80">Cargando…</div>
    )
  }

  return (
    <div className="min-h-dvh px-4 py-6">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <button className="text-sm font-semibold text-emerald-200/80 hover:text-white" onClick={onBack}>
          ‹ Volver
        </button>

        {/* Perfil */}
        <div className={sectionCls}>
          <div className={headCls}>👤 Mis datos</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nombre</label>
              <input className={field} value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Apellido</label>
              <input className={field} value={apellido} onChange={(e) => setApellido(e.target.value)} />
            </div>
          </div>
          <label className={`${labelCls} mt-3`}>¿Eres…?</label>
          <RolePicker value={role} onChange={setRole} />
          <label className={`${labelCls} mt-3`}>Teléfono</label>
          <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          <Button
            variant="primary"
            sm
            className="mt-3"
            onClick={() => run(() => updateMe(profile.id, family.id, { nombre, apellido, phone, role }), 'Datos guardados ✓')}
          >
            Guardar mis datos
          </Button>
        </div>

        {/* Familia + hijos */}
        <div className={sectionCls}>
          <div className={headCls}>👨‍👩‍👧 Mi familia</div>
          <label className={labelCls}>Apellido / familia</label>
          <div className="flex gap-2">
            <input className={field} value={famName} onChange={(e) => setFamName(e.target.value)} />
            <Button variant="ghost" sm onClick={() => run(() => updateFamilyName(family.id, famName), 'Familia guardada ✓')}>
              Guardar
            </Button>
          </div>

          <label className={`${labelCls} mt-4`}>Hijos</label>
          <div className="space-y-2">
            {kidsLocal.map((k, i) => (
              <div key={k.id || `new-${i}`} className="flex gap-2">
                <input
                  className={field}
                  value={k.name}
                  onChange={(e) => setKidsLocal((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  placeholder="Nombre del hijo/a"
                />
                <Button
                  variant="danger"
                  sm
                  onClick={() => {
                    if (k.id) void run(() => removeKid(k.id), 'Hijo eliminado')
                    else setKidsLocal((p) => p.filter((_, j) => j !== i))
                  }}
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <button className="text-xs font-semibold text-leaf" onClick={() => setKidsLocal((p) => [...p, { id: '', name: '' }])}>
              ➕ Agregar hijo
            </button>
            <button className="ml-auto text-xs font-semibold text-leaf" onClick={saveKids}>
              Guardar hijos
            </button>
          </div>
        </div>

        {/* Dirección */}
        <div className={sectionCls}>
          <div className={headCls}>🏠 Dirección</div>
          <input className={field} value={text} onChange={(e) => setText(e.target.value)} placeholder="Dirección" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <select className={field} value={region} onChange={(e) => { setRegion(e.target.value); setComuna('') }}>
              <option value="">— Región —</option>
              {Object.keys(REGIONES).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select className={field} value={comuna} onChange={(e) => setComuna(e.target.value)}>
              <option value="">— Comuna —</option>
              {comunas.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <input className={`${field} mt-3`} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Otros datos (opcional)" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant="ghost" sm onClick={doGeocode}>🔎 Ubicar</Button>
            <Button variant="ghost" sm onClick={pasteCoords}>📋 Coordenadas</Button>
            {geoMsg && <span className="text-[11px] text-ink-soft">{geoMsg}</span>}
          </div>
          <Button
            variant="primary"
            sm
            className="mt-3"
            onClick={() =>
              run(
                () => upsertAddress(family.id, addr?.id ?? null, { text, region, comuna, extra, lat: coords?.lat ?? null, lng: coords?.lng ?? null }),
                'Dirección guardada ✓',
              )
            }
          >
            Guardar dirección
          </Button>
        </div>

        {/* Co-apoderados */}
        <div className={sectionCls}>
          <div className={headCls}>👥 Padres / apoderados de la familia</div>
          <div className="space-y-1.5">
            {coParents.map((c) => (
              <div key={c.profile_id} className="flex items-center justify-between rounded-lg bg-panel2 px-3 py-2 text-sm">
                <span className="text-ink">
                  {c.name} {c.apellido} {c.role && <span className="text-ink-soft">· {c.role}</span>}
                  {c.profile_id === profile.id && <span className="ml-1 text-[11px] text-leaf">(tú)</span>}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-2xl border border-dashed border-line p-3">
            <div className="text-xs font-semibold text-ink">Invitar al otro padre/madre</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input className={field} value={coName} onChange={(e) => setCoName(e.target.value)} placeholder="Nombre" />
              <input className={field} value={coApellido} onChange={(e) => setCoApellido(e.target.value)} placeholder="Apellido" />
            </div>
            <input className={`${field} mt-2`} type="email" inputMode="email" value={coEmail} onChange={(e) => setCoEmail(e.target.value)} placeholder="correo@ejemplo.com" />
            <Button
              variant="primary"
              sm
              className="mt-2"
              disabled={!coEmail.trim()}
              onClick={() =>
                run(async () => {
                  await inviteCoParent(family.id, coEmail, `${profile.name} ${profile.apellido}`.trim(), famName)
                  setCoName(''); setCoApellido(''); setCoEmail('')
                }, 'Invitación enviada ✓')
              }
            >
              Enviar invitación
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
