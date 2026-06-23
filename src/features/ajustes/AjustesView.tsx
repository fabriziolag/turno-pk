import { useRef, useState } from 'react'
import { useStore } from '../../store/store'
import { useToast } from '../../components/toastStore'
import { Button } from '../../components/ui'
import { REGIONES } from '../../lib/regiones'
import { DAYS, DAY_LABEL, dateKey } from '../../lib/dates'
import { geocode, parseCoords } from '../../lib/geocode'
import { InvitadosManager } from '../auth/InvitadosManager'
import type { DB, School } from '../../lib/types'

const FIELD =
  'w-full rounded-[10px] border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-leaf focus:ring-[3px] focus:ring-leaf/15'
const LABEL = 'mb-1.5 block text-xs font-semibold text-ink'
const SUBHEAD = 'mt-2 mb-2.5 flex items-center gap-2 font-display text-[15px] font-semibold text-leaf'

export function AjustesView() {
  const db = useStore((s) => s.db)
  const setSchool = useStore((s) => s.setSchool)
  const setExitTime = useStore((s) => s.setExitTime)
  const importDB = useStore((s) => s.importDB)
  const resetDB = useStore((s) => s.resetDB)
  const { toast } = useToast()

  const [school, setSchoolForm] = useState<School>(() => ({ ...db.school }))
  const [geoing, setGeoing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const patch = (p: Partial<School>) => setSchoolForm((prev) => ({ ...prev, ...p }))

  async function doGeocode() {
    if (!school.text.trim()) {
      toast('Escribe la dirección', 'warn')
      return
    }
    setGeoing(true)
    const res = await geocode(school.text.trim(), school.comuna, school.region)
    setGeoing(false)
    if (res) {
      patch({ lat: res.lat, lng: res.lng })
      toast('Colegio ubicado ✓', 'ok')
    } else {
      toast('Usa "Pegar coordenadas" de Google Maps', 'warn')
    }
  }

  function doPasteCoords() {
    const def = school.lat != null ? `${school.lat}, ${school.lng}` : ''
    const input = window.prompt('Pega las coordenadas del colegio desde Google Maps (ej: -33.3863, -70.6008):', def)
    if (input == null) return
    const res = parseCoords(input)
    if (res) {
      patch({ lat: res.lat, lng: res.lng })
      toast('Coordenadas fijadas ✓', 'ok')
    } else toast('Formato inválido', 'warn')
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `turnopk-respaldo-${dateKey(new Date())}.json`
    a.click()
    toast('Respaldo exportado ✓', 'ok')
  }

  function importData(file: File) {
    const r = new FileReader()
    r.onload = () => {
      try {
        const parsed = JSON.parse(r.result as string) as DB
        importDB(parsed)
        setSchoolForm({ ...parsed.school })
        toast('Respaldo importado ✓', 'ok')
      } catch {
        toast('Archivo inválido', 'warn')
      }
    }
    r.readAsText(file)
  }

  return (
    <section>
      <h2 className="font-display text-2xl font-semibold text-ink">Ajustes</h2>
      <p className="mt-1 text-sm text-ink-soft">Colegio, horarios de salida, datos y respaldo.</p>

      <div className={SUBHEAD}>🏫 Colegio (punto de partida de la ruta)</div>
      <div className="mb-3">
        <label className={LABEL}>Nombre del colegio</label>
        <input className={FIELD} value={school.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Ej: Colegio Saint George" />
      </div>
      <div className="mb-3">
        <label className={LABEL}>Dirección</label>
        <input className={FIELD} value={school.text} onChange={(e) => patch({ text: e.target.value })} placeholder="Ej: Av. Las Hualtatas 10337" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>Región</label>
          <select className={FIELD} value={school.region} onChange={(e) => patch({ region: e.target.value, comuna: '' })}>
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
          <select className={FIELD} value={school.comuna} onChange={(e) => patch({ comuna: e.target.value })}>
            <option value="">— Comuna —</option>
            {(REGIONES[school.region] || []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3">
        <label className={LABEL}>Otros datos (opcional)</label>
        <input className={FIELD} value={school.extra} onChange={(e) => patch({ extra: e.target.value })} placeholder="Ej: Entrada por portón 2" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="ghost" sm onClick={doGeocode} disabled={geoing}>
          {geoing ? 'buscando…' : '🔎 Buscar dirección'}
        </Button>
        <Button variant="ghost" sm onClick={doPasteCoords}>
          📋 Pegar coordenadas
        </Button>
        <span className={`text-[11.5px] ${school.lat != null ? 'text-leaf' : 'text-clay'}`}>
          {school.lat != null ? `📍 Lat ${school.lat.toFixed(4)}, Lng ${school.lng!.toFixed(4)}` : 'sin ubicar'}
        </span>
      </div>
      <Button
        variant="primary"
        sm
        className="mt-3"
        onClick={() => {
          setSchool({ ...school, name: school.name.trim(), text: school.text.trim(), extra: school.extra.trim() })
          toast('Colegio guardado ✓', 'ok')
        }}
      >
        💾 Guardar colegio
      </Button>

      <hr className="my-5 border-line" />

      <div className={SUBHEAD}>🕐 Hora de salida por día</div>
      <div className="grid grid-cols-2 gap-3">
        {DAYS.map((dc) => (
          <div key={dc}>
            <label className={LABEL}>{DAY_LABEL[dc]}</label>
            <input
              type="time"
              className={FIELD}
              value={db.exitTimes[dc] || '13:20'}
              onChange={(e) => {
                setExitTime(dc, e.target.value)
                toast('Horario guardado ✓', 'ok')
              }}
            />
          </div>
        ))}
      </div>

      <hr className="my-5 border-line" />

      <div className={SUBHEAD}>💾 Respaldo de datos</div>
      <p className="mb-3 text-sm text-ink-soft">
        Exporta un archivo para respaldar o pasar la info a otro teléfono.
      </p>
      <div className="flex flex-wrap gap-2.5">
        <Button variant="primary" onClick={exportData}>
          ⬇ Exportar respaldo
        </Button>
        <Button variant="ghost" onClick={() => fileRef.current?.click()}>
          ⬆ Importar respaldo
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) importData(file)
          }}
        />
        <Button
          variant="danger"
          onClick={() => {
            if (window.confirm('¿Borrar TODOS los datos (familias, turnos, confirmaciones)? Esto no se puede deshacer.')) {
              resetDB()
              setSchoolForm({ ...useStore.getState().db.school })
              toast('Datos restablecidos')
            }
          }}
        >
          🗑 Borrar todo
        </Button>
      </div>

      <InvitadosManager />
    </section>
  )
}
