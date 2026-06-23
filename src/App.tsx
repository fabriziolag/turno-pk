import { useState } from 'react'

type ViewId = 'hoy' | 'ruta' | 'turnos' | 'familias' | 'ajustes'

const TABS: { id: ViewId; label: string; icon: string }[] = [
  { id: 'hoy', label: 'Hoy', icon: '☀️' },
  { id: 'ruta', label: 'Ruta', icon: '🗺️' },
  { id: 'turnos', label: 'Turnos', icon: '📅' },
  { id: 'familias', label: 'Familias', icon: '👨‍👩‍👧' },
  { id: 'ajustes', label: 'Ajustes', icon: '⚙️' },
]

function todayPill() {
  return new Date()
    .toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(/^\w/, (c) => c.toUpperCase())
}

export default function App() {
  const [view, setView] = useState<ViewId>('hoy')

  return (
    <div className="mx-auto max-w-[1180px] pb-24">
      {/* Top bar */}
      <header className="sticky top-0 z-50 flex items-center gap-3 border-b border-gold/25 bg-bg/90 px-4 py-3 backdrop-blur-md">
        <div className="flex flex-1 items-center gap-3 text-white">
          <div className="grid size-10 flex-none place-items-center rounded-xl bg-gradient-to-br from-gold to-gold-deep text-xl shadow-lg shadow-gold/30">
            🚐
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-semibold leading-none">Turno PK</h1>
            <div className="mt-1 text-[11.5px] font-light text-emerald-200/80">
              Furgón compartido
            </div>
          </div>
        </div>
        <div className="whitespace-nowrap rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-bg">
          {todayPill()}
        </div>
      </header>

      {/* Tabs */}
      <nav className="sticky top-[60px] z-40 flex gap-1 overflow-x-auto px-3 pt-2.5 [scrollbar-width:none]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`flex flex-none items-center gap-1.5 whitespace-nowrap rounded-t-xl px-4 py-2.5 text-sm font-semibold transition ${
              view === t.id
                ? 'bg-panel text-ink'
                : 'text-emerald-200/70 hover:text-emerald-100'
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {/* Surface */}
      <main className="mx-3 min-h-[60vh] rounded-b-[18px] bg-panel px-5 pb-8 pt-6 shadow-2xl shadow-black/20">
        <Placeholder view={view} />
      </main>
    </div>
  )
}

function Placeholder({ view }: { view: ViewId }) {
  const copy: Record<ViewId, { title: string; note: string }> = {
    hoy: { title: 'Confirmación del día', note: 'Quién va, quién retira, plan por WhatsApp.' },
    ruta: { title: 'Ruta de entrega', note: 'Orden óptimo, mapa y avisos de entrega.' },
    turnos: { title: 'Planificación de turnos', note: 'Grilla semanal y contador anual.' },
    familias: { title: 'Familias del turno', note: 'Niños, papás, direcciones y contactos.' },
    ajustes: { title: 'Ajustes', note: 'Colegio, horarios de salida y respaldo.' },
  }
  const c = copy[view]
  return (
    <section>
      <h2 className="font-display text-2xl font-semibold text-ink">{c.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{c.note}</p>
      <div className="mt-10 rounded-2xl border border-dashed border-line bg-panel2 px-6 py-16 text-center">
        <div className="text-5xl opacity-50">🚧</div>
        <p className="mt-3 font-display text-lg text-ink">En construcción</p>
        <p className="mt-1 text-sm text-ink-soft">
          Portando esta pestaña desde tu demo. Ya viene.
        </p>
      </div>
    </section>
  )
}
