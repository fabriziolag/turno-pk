import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/ui'
import { Collapsible } from '../../components/Collapsible'
import { PhotoButton } from '../../components/PhotoButton'
import { useToast } from '../../components/toastStore'
import { REGIONES } from '../../lib/regiones'
import { geocode, parseCoords } from '../../lib/geocode'
import { enablePush, isPushOn, notifyFamily, pushSupported } from '../../lib/push'
import {
  addAddress,
  addContact,
  addKid,
  inviteCoParent,
  removeAddress,
  removeContact,
  removeKid,
  renameKid,
  setAddressPhoto,
  setContactPhoto,
  setKidPhoto,
  setProfilePhoto,
  updateAddress,
  updateContact,
  updateFamilyName,
  updateMe,
  type AddressInput,
  type AddressRow,
  type Contact,
  type MyContext,
} from '../../lib/identity'

const field =
  'w-full rounded-[10px] border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-leaf focus:ring-[3px] focus:ring-leaf/15'
const labelCls = 'mb-1.5 block text-xs font-semibold text-ink'
const sectionCls = 'rounded-3xl bg-panel p-5 shadow-2xl shadow-black/30'
const headCls = 'mb-3 font-display text-[15px] font-semibold text-leaf'
const ADDR_LABELS = ['Casa', 'Casa papá', 'Casa mamá', 'Otra']

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
  const { profile, family, kids, addresses, contacts, coParents, pendingCoParents } = ctx
  const { toast } = useToast()

  const [nombre, setNombre] = useState(profile.name)
  const [apellido, setApellido] = useState(profile.apellido)
  const [phone, setPhone] = useState(profile.phone)
  const [role, setRole] = useState(ctx.myRole)
  const [famName, setFamName] = useState(family?.fam_name ?? '')
  const [kidsLocal, setKidsLocal] = useState(kids.map((k) => ({ id: k.id, name: k.name })))
  const [coName, setCoName] = useState('')
  const [coApellido, setCoApellido] = useState('')
  const [coEmail, setCoEmail] = useState('')
  const [addingAddr, setAddingAddr] = useState(false)
  const [addingContact, setAddingContact] = useState(false)
  const [pushOn, setPushOn] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)

  useEffect(() => {
    void isPushOn().then(setPushOn)
  }, [])

  async function activarAvisos() {
    setPushBusy(true)
    const r = await enablePush(profile.id)
    setPushBusy(false)
    if (r === 'ok') {
      setPushOn(true)
      toast('Avisos activados ✓', 'ok')
    } else if (r === 'denied') toast('Permiso de notificaciones rechazado', 'warn')
    else if (r === 'unsupported') toast('Tu dispositivo no soporta avisos (en iPhone, instala la app primero)', 'warn')
    else if (r === 'noconfig') toast('Faltan las llaves VAPID en el sitio', 'warn')
    else toast('No se pudo activar', 'warn')
  }

  async function probarAviso() {
    if (!family) return
    const r = await notifyFamily(family.id, 'Turno PK 🚐', 'Notificación de prueba ✓')
    toast(r.ok ? `Función respondió: ${r.info}` : `Error: ${r.info}`, r.ok ? 'ok' : 'warn')
  }

  async function run(fn: () => Promise<void>, ok: string) {
    try {
      await fn()
      toast(ok, 'ok')
      onChanged()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'warn')
    }
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

  if (!family) return <div className="grid min-h-dvh place-items-center text-emerald-200/80">Cargando…</div>

  return (
    <div className="min-h-dvh px-4 py-6">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <button className="text-sm font-semibold text-emerald-200/80 hover:text-white" onClick={onBack}>
          ‹ Volver
        </button>

        {/* AVISOS (push) */}
        {pushSupported() && (
          <div className={sectionCls}>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className={headCls} style={{ marginBottom: 2 }}>🔔 Avisos en el teléfono</div>
                <div className="text-[11.5px] text-ink-soft">
                  {pushOn
                    ? 'Activados ✓ — te avisaremos cuando entreguen a tu hijo/a y novedades del turno.'
                    : 'Recibe un aviso cuando entreguen a tu hijo/a, aunque no tengas la app abierta. En iPhone, instala la app primero.'}
                </div>
              </div>
              {!pushOn ? (
                <Button variant="primary" sm onClick={activarAvisos} disabled={pushBusy}>
                  {pushBusy ? '…' : 'Activar'}
                </Button>
              ) : (
                <Button variant="ghost" sm onClick={probarAviso}>
                  Probar
                </Button>
              )}
            </div>
          </div>
        )}

        {/* MIS DATOS */}
        <div className={sectionCls}>
          <div className={headCls}>👤 Mis datos</div>
          <div className="flex items-center gap-3">
            <PhotoButton
              value={profile.photo}
              onPick={(d) => void run(() => setProfilePhoto(profile.id, d), 'Foto guardada ✓')}
            />
            <div className="grid flex-1 grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Nombre</label>
                <input className={field} value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Apellido</label>
                <input className={field} value={apellido} onChange={(e) => setApellido(e.target.value)} />
              </div>
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

        {/* FAMILIA + HIJOS */}
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
              <div key={k.id || `new-${i}`} className="flex items-center gap-2">
                {k.id ? (
                  <PhotoButton
                    size={40}
                    value={kids.find((o) => o.id === k.id)?.photo}
                    onPick={(d) => void run(() => setKidPhoto(k.id, d), 'Foto guardada ✓')}
                  />
                ) : (
                  <div className="grid size-10 flex-none place-items-center rounded-full bg-panel2 text-ink-soft">🧒</div>
                )}
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

        {/* PADRES / APODERADOS */}
        <div className={sectionCls}>
          <div className={headCls}>👥 Padres / apoderados de la familia</div>
          <div className="space-y-1.5">
            {coParents.map((c) => (
              <div key={c.profile_id} className="rounded-lg bg-panel2 px-3 py-2 text-sm text-ink">
                {c.name} {c.apellido} {c.role && <span className="text-ink-soft">· {c.role}</span>}
                {c.profile_id === profile.id && <span className="ml-1 text-[11px] text-leaf">(tú)</span>}
              </div>
            ))}
            {pendingCoParents.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-[#faf6e8] px-3 py-2 text-sm">
                <span className="text-gold-deep">{p.email}</span>
                <span className="text-[11px] font-semibold text-gold-deep">invitación pendiente</span>
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

        {/* DIRECCIONES (colapsable) */}
        <Collapsible title="🏠 Direcciones de la casa">
          <div className="space-y-3">
            {addresses.map((a) => (
              <AddressCard key={a.id} familyId={family.id} addr={a} onChanged={onChanged} />
            ))}
            {addingAddr && (
              <AddressCard
                familyId={family.id}
                addr={null}
                onChanged={() => {
                  setAddingAddr(false)
                  onChanged()
                }}
              />
            )}
            {!addingAddr && (
              <button className="text-xs font-semibold text-leaf" onClick={() => setAddingAddr(true)}>
                ➕ Agregar otra dirección
              </button>
            )}
          </div>
        </Collapsible>

        {/* CONTACTOS (colapsable) */}
        <Collapsible title="📞 Contactos de la casa (nana, abuelo, quien recibe…)">
          <div className="space-y-3">
            {contacts.map((c) => (
              <ContactCard key={c.id} familyId={family.id} contact={c} onChanged={onChanged} />
            ))}
            {addingContact && (
              <ContactCard
                familyId={family.id}
                contact={null}
                onChanged={() => {
                  setAddingContact(false)
                  onChanged()
                }}
              />
            )}
            {!addingContact && (
              <button className="text-xs font-semibold text-leaf" onClick={() => setAddingContact(true)}>
                ➕ Agregar contacto
              </button>
            )}
          </div>
        </Collapsible>
      </div>
    </div>
  )
}

function AddressCard({
  familyId,
  addr,
  onChanged,
}: {
  familyId: string
  addr: AddressRow | null
  onChanged: () => void
}) {
  const { toast } = useToast()
  const [labelV, setLabelV] = useState(addr?.label ?? 'Casa')
  const [text, setText] = useState(addr?.text ?? '')
  const [region, setRegion] = useState(addr?.region ?? '')
  const [comuna, setComuna] = useState(addr?.comuna ?? '')
  const [extra, setExtra] = useState(addr?.extra ?? '')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    addr?.lat != null && addr?.lng != null ? { lat: addr.lat, lng: addr.lng } : null,
  )
  const [geoMsg, setGeoMsg] = useState('')
  const comunas = useMemo(() => (region && REGIONES[region]) || [], [region])

  const data: AddressInput = { label: labelV, text, region, comuna, extra, lat: coords?.lat ?? null, lng: coords?.lng ?? null }

  async function save() {
    try {
      if (addr) await updateAddress(addr.id, data)
      else await addAddress(familyId, data, 0)
      toast('Dirección guardada ✓', 'ok')
      onChanged()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'warn')
    }
  }
  async function doGeo() {
    if (!text.trim()) return setGeoMsg('Escribe la dirección')
    setGeoMsg('buscando…')
    const r = await geocode(text.trim(), comuna, region)
    if (r) { setCoords(r); setGeoMsg('Ubicada ✓') } else setGeoMsg('No se pudo — pega coordenadas')
  }
  function paste() {
    const inp = prompt('Coordenadas (ej -33.36, -70.53):', '')
    if (inp == null) return
    const r = parseCoords(inp)
    if (r) { setCoords(r); setGeoMsg('Coordenadas ✓') } else setGeoMsg('Formato inválido')
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-3">
      <div className="flex items-start gap-3">
        {addr ? (
          <PhotoButton size={56} rounded="lg" value={addr.house_photo} placeholder="🏠"
            onPick={(d) => { void setAddressPhoto(addr.id, d).then(onChanged) }} />
        ) : (
          <div className="grid size-14 flex-none place-items-center rounded-xl bg-panel2 text-ink-soft">🏠</div>
        )}
        <select className={field} value={labelV} onChange={(e) => setLabelV(e.target.value)}>
          {ADDR_LABELS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>
      <input className={`${field} mt-2`} value={text} onChange={(e) => setText(e.target.value)} placeholder="Dirección" />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <select className={field} value={region} onChange={(e) => { setRegion(e.target.value); setComuna('') }}>
          <option value="">— Región —</option>
          {Object.keys(REGIONES).map((r) => (<option key={r} value={r}>{r}</option>))}
        </select>
        <select className={field} value={comuna} onChange={(e) => setComuna(e.target.value)}>
          <option value="">— Comuna —</option>
          {comunas.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
      </div>
      <input className={`${field} mt-2`} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Otros datos (opcional)" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button variant="ghost" sm onClick={doGeo}>🔎 Ubicar</Button>
        <Button variant="ghost" sm onClick={paste}>📋 Coordenadas</Button>
        {geoMsg && <span className="text-[11px] text-ink-soft">{geoMsg}</span>}
      </div>
      <div className="mt-2 flex gap-2">
        <Button variant="primary" sm onClick={save}>Guardar dirección</Button>
        {addr && (
          <Button variant="danger" sm onClick={() => { void removeAddress(addr.id).then(onChanged) }}>
            Eliminar
          </Button>
        )}
      </div>
    </div>
  )
}

function ContactCard({
  familyId,
  contact,
  onChanged,
}: {
  familyId: string
  contact: Contact | null
  onChanged: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState(contact?.name ?? '')
  const [relation, setRelation] = useState(contact?.relation ?? '')
  const [phone, setPhone] = useState(contact?.phone ?? '')
  const [isDefault, setIsDefault] = useState(contact?.is_default ?? false)

  async function save() {
    try {
      const d = { name, relation, phone, is_default: isDefault }
      if (contact) await updateContact(contact.id, d)
      else await addContact(familyId, d)
      toast('Contacto guardado ✓', 'ok')
      onChanged()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'warn')
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-3">
      <div className="flex items-start gap-3">
        {contact ? (
          <PhotoButton size={48} value={contact.photo} onPick={(d) => { void setContactPhoto(contact.id, d).then(onChanged) }} />
        ) : (
          <div className="grid size-12 flex-none place-items-center rounded-full bg-panel2 text-ink-soft">👤</div>
        )}
        <div className="grid flex-1 grid-cols-2 gap-2">
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" />
          <input className={field} value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="Relación (nana, abuelo…)" />
        </div>
      </div>
      <input className={`${field} mt-2`} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono" inputMode="tel" />
      <label className="mt-2 flex cursor-pointer items-center gap-2 text-[12px] text-ink">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="size-4 accent-leaf" />
        ⭐ Contacto principal (recibe al niño / abre el portón)
      </label>
      <div className="mt-2 flex gap-2">
        <Button variant="primary" sm onClick={save}>Guardar contacto</Button>
        {contact && (
          <Button variant="danger" sm onClick={() => { void removeContact(contact.id).then(onChanged) }}>
            Eliminar
          </Button>
        )}
      </div>
    </div>
  )
}
