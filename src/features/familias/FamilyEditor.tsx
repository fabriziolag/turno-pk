import { useState } from 'react'
import type { Address, Contact, Family, Parent } from '../../lib/types'
import { REGIONES } from '../../lib/regiones'
import { uid } from '../../lib/format'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/ui'
import { useToast } from '../../components/toastStore'
import { fileToDownscaledDataUrl } from '../../lib/photo'
import { geocode, parseCoords } from '../../lib/geocode'

const ROLES = ['', 'papá', 'mamá', 'abuelo', 'abuela', 'tío', 'tía', 'nana', 'otro']

const FIELD =
  'w-full rounded-[10px] border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-leaf focus:ring-[3px] focus:ring-leaf/15'
const LABEL = 'mb-1.5 block text-xs font-semibold text-ink'
const SUBHEAD = 'mt-4 mb-2.5 flex items-center gap-2 font-display text-[15px] font-semibold text-leaf'

function blankFamily(): Family {
  return {
    id: uid(),
    kidName: '',
    kidPhoto: '',
    famName: '',
    parents: [
      { name: '', role: 'papá', phone: '', email: '', photo: '' },
      { name: '', role: 'mamá', phone: '', email: '', photo: '' },
    ],
    addresses: [
      { label: 'Casa', text: '', region: '', comuna: '', extra: '', housePhoto: '', lat: null, lng: null },
    ],
    contacts: [],
  }
}

function PhotoUpload({
  value,
  onChange,
  className = 'h-[60px] w-[60px] rounded-2xl',
  empty = '📷',
}: {
  value: string
  onChange: (dataUrl: string) => void
  className?: string
  empty?: string
}) {
  const { toast } = useToast()
  return (
    <label
      className={`grid flex-none cursor-pointer place-items-center overflow-hidden border-2 border-dashed border-line bg-panel2 text-2xl text-ink-soft ${className}`}
    >
      {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : empty}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          try {
            onChange(await fileToDownscaledDataUrl(file))
          } catch {
            toast('No se pudo procesar la imagen', 'warn')
          }
        }}
      />
    </label>
  )
}

interface FamilyEditorProps {
  family: Family | null // null = nueva familia
  onSave: (f: Family) => void
  onDelete?: (id: string) => void
  onClose: () => void
}

export function FamilyEditor({ family, onSave, onDelete, onClose }: FamilyEditorProps) {
  const isNew = !family
  const { toast } = useToast()
  const [f, setF] = useState<Family>(() => (family ? structuredClone(family) : blankFamily()))
  const [geoing, setGeoing] = useState<number | null>(null)

  const patch = (p: Partial<Family>) => setF((prev) => ({ ...prev, ...p }))
  const patchParent = (i: number, p: Partial<Parent>) =>
    setF((prev) => ({ ...prev, parents: prev.parents.map((x, j) => (j === i ? { ...x, ...p } : x)) }))
  const patchAddr = (i: number, p: Partial<Address>) =>
    setF((prev) => ({ ...prev, addresses: prev.addresses.map((x, j) => (j === i ? { ...x, ...p } : x)) }))
  const patchContact = (i: number, p: Partial<Contact>) =>
    setF((prev) => ({ ...prev, contacts: prev.contacts.map((x, j) => (j === i ? { ...x, ...p } : x)) }))

  async function doGeocode(i: number) {
    const a = f.addresses[i]
    if (!a.text.trim()) {
      toast('Escribe la dirección primero', 'warn')
      return
    }
    setGeoing(i)
    const res = await geocode(a.text.trim(), a.comuna, a.region)
    setGeoing(null)
    if (res) {
      patchAddr(i, { lat: res.lat, lng: res.lng })
      toast('Dirección ubicada ✓', 'ok')
    } else {
      toast('No se pudo ubicar. Usa "Pegar coordenadas" de Google Maps.', 'warn')
    }
  }

  function doPasteCoords(i: number) {
    const cur = f.addresses[i]
    const def = cur.lat != null ? `${cur.lat}, ${cur.lng}` : ''
    const input = window.prompt(
      'Pega las coordenadas desde Google Maps (formato: -33.3601, -70.5305).\n\nEn Google Maps: mantén presionada la casa → aparecen los números arriba → cópialos.',
      def,
    )
    if (input == null) return
    const res = parseCoords(input)
    if (res) {
      patchAddr(i, { lat: res.lat, lng: res.lng })
      toast('Coordenadas fijadas ✓', 'ok')
    } else {
      toast('Formato inválido. Debe ser: -33.36, -70.53', 'warn')
    }
  }

  function addAddress() {
    if (f.addresses.length >= 2) {
      toast('Máximo 2 direcciones', 'warn')
      return
    }
    patch({
      addresses: [
        ...f.addresses,
        { label: 'Casa 2', text: '', region: '', comuna: '', extra: '', housePhoto: '', lat: null, lng: null },
      ],
    })
  }

  function setDefaultContact(i: number) {
    patch({ contacts: f.contacts.map((c, j) => ({ ...c, isDefault: j === i })) })
  }

  function save() {
    const clean: Family = { ...f, kidName: f.kidName.trim(), famName: f.famName.trim() }
    if (!clean.kidName) {
      toast('Pon al menos el nombre del niño', 'warn')
      return
    }
    onSave(clean)
  }

  return (
    <Modal
      title={isNew ? 'Nueva familia' : 'Editar familia'}
      onClose={onClose}
      wide
      footer={
        <>
          {!isNew && onDelete && (
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm('¿Eliminar esta familia del turno?')) onDelete(f.id)
              }}
            >
              🗑 Eliminar
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save}>
            💾 Guardar
          </Button>
        </>
      }
    >
      {/* Niño */}
      <div className={SUBHEAD}>🧒 Niño / niña del turno</div>
      <div className="flex items-center gap-3">
        <PhotoUpload value={f.kidPhoto} onChange={(d) => patch({ kidPhoto: d })} />
        <span className="text-[11.5px] text-ink-soft">Toca la foto para elegir o tomar una imagen</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>Nombre del niño</label>
          <input className={FIELD} value={f.kidName} onChange={(e) => patch({ kidName: e.target.value })} placeholder="Matilde" />
        </div>
        <div>
          <label className={LABEL}>Apellido / Familia</label>
          <input className={FIELD} value={f.famName} onChange={(e) => patch({ famName: e.target.value })} placeholder="Balut" />
        </div>
      </div>

      <hr className="my-4 border-line" />

      {/* Apoderados */}
      {f.parents.map((p, i) => (
        <div key={i}>
          <div className={SUBHEAD}>👤 Apoderado {i + 1}</div>
          <div className="flex items-center gap-3">
            <PhotoUpload value={p.photo} onChange={(d) => patchParent(i, { photo: d })} />
            <span className="text-[11.5px] text-ink-soft">Foto del apoderado (opcional)</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Nombre completo</label>
              <input className={FIELD} value={p.name} onChange={(e) => patchParent(i, { name: e.target.value })} placeholder="Ej: Fabrizio Álvarez" />
            </div>
            <div>
              <label className={LABEL}>Rol</label>
              <select className={FIELD} value={p.role} onChange={(e) => patchParent(i, { role: e.target.value })}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r || '—'}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Teléfono (WhatsApp)</label>
              <input className={FIELD} value={p.phone} onChange={(e) => patchParent(i, { phone: e.target.value })} placeholder="+569..." inputMode="tel" />
            </div>
            <div>
              <label className={LABEL}>Email</label>
              <input className={FIELD} value={p.email} onChange={(e) => patchParent(i, { email: e.target.value })} placeholder="correo@..." inputMode="email" />
            </div>
          </div>
        </div>
      ))}

      <hr className="my-4 border-line" />

      {/* Direcciones */}
      {f.addresses.map((a, i) => (
        <div key={i}>
          <div className={SUBHEAD}>
            🏠 Dirección {i + 1}
            {i > 0 && (
              <Button
                variant="danger"
                sm
                className="ml-auto"
                onClick={() => patch({ addresses: f.addresses.filter((_, j) => j !== i) })}
              >
                Quitar
              </Button>
            )}
          </div>
          <div className="mb-3">
            <label className={LABEL}>Etiqueta</label>
            <input className={FIELD} value={a.label} onChange={(e) => patchAddr(i, { label: e.target.value })} placeholder="Casa / Casa papá / Casa mamá" />
          </div>
          <div className="mb-3">
            <label className={LABEL}>Dirección</label>
            <input className={FIELD} value={a.text} onChange={(e) => patchAddr(i, { text: e.target.value })} placeholder="Ej: Camino La Cumbre 5066" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Región</label>
              <select className={FIELD} value={a.region} onChange={(e) => patchAddr(i, { region: e.target.value, comuna: '' })}>
                <option value="">— Región —</option>
                {Object.keys(REGIONES).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Comuna</label>
              <select className={FIELD} value={a.comuna} onChange={(e) => patchAddr(i, { comuna: e.target.value })}>
                <option value="">— Comuna —</option>
                {(REGIONES[a.region] || []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className={LABEL}>Otros datos (opcional)</label>
            <input className={FIELD} value={a.extra} onChange={(e) => patchAddr(i, { extra: e.target.value })} placeholder="Ej: Casa T" />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <PhotoUpload
              value={a.housePhoto}
              onChange={(d) => patchAddr(i, { housePhoto: d })}
              className="h-[60px] w-20 rounded-[10px]"
              empty="🏠"
            />
            <span className="text-[11.5px] text-ink-soft">
              Foto de la fachada/portón (ayuda al conductor primerizo a reconocerla)
            </span>
          </div>
          <div className="mt-3">
            <label className={LABEL}>Ubicación en el mapa</label>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" sm onClick={() => doGeocode(i)} disabled={geoing === i}>
                {geoing === i ? 'buscando…' : '🔎 Buscar dirección'}
              </Button>
              <Button variant="ghost" sm onClick={() => doPasteCoords(i)}>
                📋 Pegar coordenadas
              </Button>
              <span className={`text-[11.5px] ${a.lat != null ? 'text-leaf' : 'text-clay'}`}>
                {a.lat != null ? `📍 Lat ${a.lat.toFixed(4)}, Lng ${a.lng!.toFixed(4)}` : 'sin ubicar'}
              </span>
            </div>
          </div>
        </div>
      ))}
      {f.addresses.length < 2 && (
        <Button variant="ghost" sm className="mt-2" onClick={addAddress}>
          ➕ Agregar segunda dirección (padres separados)
        </Button>
      )}

      <hr className="my-4 border-line" />

      {/* Contactos */}
      <div className={SUBHEAD}>📞 Contactos de entrega</div>
      <p className="mb-3 text-[13px] text-ink-soft">
        Personas que pueden recibir al niño (nana, abuelo, etc.). Marca uno como predefinido para
        anunciar la llegada y abrir el portón.
      </p>
      {f.contacts.map((c, i) => (
        <div key={i} className="mb-2.5 rounded-xl border border-line bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <b className="text-[13px]">Contacto {i + 1}</b>
            <Button variant="danger" sm onClick={() => patch({ contacts: f.contacts.filter((_, j) => j !== i) })}>
              Quitar
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Nombre</label>
              <input className={FIELD} value={c.name} onChange={(e) => patchContact(i, { name: e.target.value })} placeholder="Ej: Rosa" />
            </div>
            <div>
              <label className={LABEL}>Relación</label>
              <input className={FIELD} value={c.relation} onChange={(e) => patchContact(i, { relation: e.target.value })} placeholder="Ej: Nana / Abuelo" />
            </div>
          </div>
          <div className="mt-3">
            <label className={LABEL}>Teléfono</label>
            <input className={FIELD} value={c.phone} onChange={(e) => patchContact(i, { phone: e.target.value })} placeholder="+569..." inputMode="tel" />
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-[12.5px]">
            <input type="radio" name="defaultContact" checked={c.isDefault} onChange={() => setDefaultContact(i)} className="w-auto" />
            ⭐ Contacto de entrega predefinido
          </label>
        </div>
      ))}
      <Button
        variant="ghost"
        sm
        className="mt-1"
        onClick={() =>
          patch({
            contacts: [...f.contacts, { name: '', relation: '', phone: '', isDefault: f.contacts.length === 0 }],
          })
        }
      >
        ➕ Agregar contacto
      </Button>
    </Modal>
  )
}
