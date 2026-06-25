import { useMemo, useState } from 'react'
import { Button } from '../../components/ui'
import { useToast } from '../../components/toastStore'
import { REGIONES } from '../../lib/regiones'
import { geocode, parseCoords } from '../../lib/geocode'
import { DAYS, DAY_LABEL } from '../../lib/dates'
import { updateTurnoSettings, type MyTurno } from '../../lib/turnos'
import type { DayCode } from '../../lib/types'

const field =
  'w-full rounded-[10px] border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-leaf focus:ring-[3px] focus:ring-leaf/15'
const labelCls = 'mb-1.5 block text-xs font-semibold text-ink'
const EMOJIS = ['🚐', '🚌', '🚗', '🏫', '🎒', '⭐', '🌟', '🦊', '🐢', '🐝', '🚀', '🌈', '⚽', '🎨', '🦁', '🐧']

export function TurnoAjustes({ turno, onSaved }: { turno: MyTurno; onSaved: () => void }) {
  const { toast } = useToast()
  const [emoji, setEmoji] = useState(turno.emoji)
  const [name, setName] = useState(turno.name)
  const [schName, setSchName] = useState(turno.school_name)
  const [schText, setSchText] = useState(turno.school_text)
  const [region, setRegion] = useState(turno.school_region)
  const [comuna, setComuna] = useState(turno.school_comuna)
  const [schExtra, setSchExtra] = useState(turno.school_extra)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    turno.school_lat != null && turno.school_lng != null ? { lat: turno.school_lat, lng: turno.school_lng } : null,
  )
  const [geoMsg, setGeoMsg] = useState('')
  const [exit, setExit] = useState<Record<string, string>>(turno.exit_times ?? {})
  const [busy, setBusy] = useState(false)

  const comunas = useMemo(() => (region && REGIONES[region]) || [], [region])

  async function doGeo() {
    if (!schText.trim()) return setGeoMsg('Escribe la dirección del colegio')
    setGeoMsg('buscando…')
    const r = await geocode(schText.trim(), comuna, region)
    if (r) {
      setCoords(r)
      setGeoMsg('Ubicado ✓')
    } else setGeoMsg('No se pudo — pega coordenadas')
  }
  function paste() {
    const inp = prompt('Coordenadas del colegio (ej -33.38, -70.60):', '')
    if (inp == null) return
    const r = parseCoords(inp)
    if (r) {
      setCoords(r)
      setGeoMsg('Coordenadas ✓')
    } else setGeoMsg('Formato inválido')
  }

  async function save() {
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      await updateTurnoSettings(turno.id, {
        emoji,
        name: name.trim(),
        school_name: schName.trim(),
        school_text: schText.trim(),
        school_region: region,
        school_comuna: comuna,
        school_extra: schExtra.trim(),
        school_lat: coords?.lat ?? null,
        school_lng: coords?.lng ?? null,
        exit_times: exit,
      })
      toast('Ajustes guardados ✓', 'ok')
      onSaved()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'warn')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-2.5 font-display text-[15px] font-semibold text-leaf">🚐 Turno</div>
      <label className={labelCls}>Emoji</label>
      <div className="flex flex-wrap gap-1.5">
        {EMOJIS.map((e) => (
          <button
            key={e}
            onClick={() => setEmoji(e)}
            className={`grid size-10 place-items-center rounded-xl text-xl transition ${
              emoji === e ? 'bg-leaf/20 ring-2 ring-leaf' : 'bg-panel2 hover:bg-[#e9e4d3]'
            }`}
          >
            {e}
          </button>
        ))}
      </div>
      <label className={`${labelCls} mt-3`}>Nombre del turno</label>
      <input className={field} value={name} onChange={(e) => setName(e.target.value)} />

      <hr className="my-4 border-line" />
      <div className="mb-2.5 font-display text-[15px] font-semibold text-leaf">🏫 Colegio (inicio de la ruta)</div>
      <label className={labelCls}>Nombre del colegio</label>
      <input className={field} value={schName} onChange={(e) => setSchName(e.target.value)} placeholder="Colegio Saint George" />
      <label className={`${labelCls} mt-3`}>Dirección</label>
      <input className={field} value={schText} onChange={(e) => setSchText(e.target.value)} placeholder="Av. Las Hualtatas 10337" />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Región</label>
          <select className={field} value={region} onChange={(e) => { setRegion(e.target.value); setComuna('') }}>
            <option value="">— Región —</option>
            {Object.keys(REGIONES).map((r) => (<option key={r} value={r}>{r}</option>))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Comuna</label>
          <select className={field} value={comuna} onChange={(e) => setComuna(e.target.value)}>
            <option value="">— Comuna —</option>
            {comunas.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
        </div>
      </div>
      <label className={`${labelCls} mt-3`}>Otros datos (opcional)</label>
      <input className={field} value={schExtra} onChange={(e) => setSchExtra(e.target.value)} placeholder="Entrada por portón 2" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button variant="ghost" sm onClick={doGeo}>🔎 Ubicar colegio</Button>
        <Button variant="ghost" sm onClick={paste}>📋 Coordenadas</Button>
        {geoMsg && <span className="text-[11px] text-ink-soft">{geoMsg}</span>}
      </div>

      <hr className="my-4 border-line" />
      <div className="mb-2.5 font-display text-[15px] font-semibold text-leaf">🕐 Hora de salida por día</div>
      <div className="grid grid-cols-2 gap-3">
        {DAYS.map((dc: DayCode) => (
          <div key={dc}>
            <label className={labelCls}>{DAY_LABEL[dc]}</label>
            <input
              type="time"
              className={field}
              value={exit[dc] ?? ''}
              onChange={(e) => setExit((p) => ({ ...p, [dc]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      <Button variant="primary" className="mt-5 w-full" onClick={save} disabled={busy || !name.trim()}>
        {busy ? 'Guardando…' : 'Guardar ajustes del turno'}
      </Button>
    </div>
  )
}
