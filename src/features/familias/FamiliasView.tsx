import { useState } from 'react'
import type { Family } from '../../lib/types'
import { useStore } from '../../store/store'
import { useToast } from '../../components/toastStore'
import { Button } from '../../components/ui'
import { famColor, initials } from '../../lib/format'
import { FamilyEditor } from './FamilyEditor'

export function FamiliasView() {
  const families = useStore((s) => s.db.families)
  const addFamily = useStore((s) => s.addFamily)
  const updateFamily = useStore((s) => s.updateFamily)
  const removeFamily = useStore((s) => s.removeFamily)
  const { toast } = useToast()
  const [editing, setEditing] = useState<Family | 'new' | null>(null)

  function waFamily(f: Family) {
    const phone = f.parents.find((p) => p.phone)?.phone
    if (!phone) {
      toast('Esta familia no tiene teléfono cargado', 'warn')
      return
    }
    window.open(`https://wa.me/${phone.replace(/[^\d]/g, '')}`, '_blank')
  }

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Familias del turno</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Ficha de cada niño y sus papás, con fotos, direcciones y contactos.
          </p>
        </div>
        <Button variant="gold" onClick={() => setEditing('new')}>
          ＋ Agregar familia
        </Button>
      </div>

      {families.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-line bg-panel2 px-6 py-16 text-center">
          <div className="text-5xl opacity-50">👨‍👩‍👧‍👦</div>
          <p className="mt-3 font-display text-lg text-ink">Aún no hay familias</p>
          <p className="mt-1 text-sm text-ink-soft">Agrega las familias del turno para empezar.</p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-4">
          {families.map((f, i) => (
            <FamilyCard key={f.id} f={f} color={famColor(i)} onEdit={() => setEditing(f)} onWa={() => waFamily(f)} />
          ))}
        </div>
      )}

      {editing !== null && (
        <FamilyEditor
          family={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(f) => {
            if (editing === 'new') addFamily(f)
            else updateFamily(f)
            setEditing(null)
            toast(editing === 'new' ? 'Familia agregada ✓' : 'Cambios guardados ✓', 'ok')
          }}
          onDelete={(id) => {
            removeFamily(id)
            setEditing(null)
            toast('Familia eliminada')
          }}
        />
      )}
    </section>
  )
}

function FamilyCard({
  f,
  color,
  onEdit,
  onWa,
}: {
  f: Family
  color: string
  onEdit: () => void
  onWa: () => void
}) {
  const loc = (a: Family['addresses'][number]) => [a.comuna, a.region].filter(Boolean).join(', ')
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel2 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="h-[7px] w-full" style={{ background: color }} />
      <div className="flex items-center gap-3 px-4 pb-3 pt-4">
        {f.kidPhoto ? (
          <img src={f.kidPhoto} alt="" className="size-14 flex-none rounded-full border-[3px] border-white object-cover shadow" />
        ) : (
          <div className="grid size-14 flex-none place-items-center rounded-full border-[3px] border-white font-display text-2xl text-white shadow" style={{ background: color }}>
            {initials(f.kidName)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-semibold leading-tight text-ink">{f.kidName || 'Sin nombre'}</div>
          <div className="mt-0.5 text-xs font-medium text-ink-soft">Familia {f.famName || '—'}</div>
          <div className="mt-2 flex gap-1.5">
            {f.parents
              .filter((p) => p.photo || p.name)
              .map((p, j) =>
                p.photo ? (
                  <img key={j} src={p.photo} title={p.name} alt="" className="size-[30px] rounded-full border-2 border-white object-cover shadow-sm" />
                ) : (
                  <div key={j} title={p.name} className="grid size-[30px] place-items-center rounded-full border-2 border-white text-xs text-white shadow-sm" style={{ background: color }}>
                    {initials(p.name)}
                  </div>
                ),
              )}
          </div>
        </div>
      </div>

      <div className="px-4 pb-3.5 text-[13px] text-ink-soft">
        {f.addresses.map((a, j) => (
          <div key={j} className="flex items-start gap-2 border-t border-dashed border-line py-1.5">
            <span className="mt-0.5 w-4 flex-none opacity-60">🏠</span>
            <div>
              <b>{a.label}:</b> {a.text || '—'}
              {a.extra && <span className="text-[11px]"> ({a.extra})</span>}
              {loc(a) && <div className="text-[11px]">{loc(a)}</div>}
              <div className="text-[11px]">
                {a.lat != null ? (
                  <span className="text-leaf">📍 ubicada</span>
                ) : (
                  <span className="text-clay">sin ubicar</span>
                )}
              </div>
            </div>
          </div>
        ))}
        {f.parents
          .filter((p) => p.name || p.phone || p.email)
          .map((p, j) => (
            <div key={j} className="flex items-start gap-2 border-t border-dashed border-line py-1.5">
              <span className="mt-0.5 w-4 flex-none opacity-60">👤</span>
              <div>
                {p.name || '—'}
                {p.role && <span className="text-[11px]"> ({p.role})</span>}
                {p.phone && (
                  <>
                    {' · '}
                    <a href={`tel:${p.phone}`} className="text-leaf">
                      {p.phone}
                    </a>
                  </>
                )}
                {p.email && (
                  <>
                    {' · '}
                    <a href={`mailto:${p.email}`} className="text-leaf">
                      ✉
                    </a>
                  </>
                )}
              </div>
            </div>
          ))}
        {f.contacts.map((c, j) => (
          <div key={j} className="flex items-start gap-2 border-t border-dashed border-line py-1.5">
            <span className="mt-0.5 w-4 flex-none opacity-60">📞</span>
            <div>
              {c.name || '—'}
              {c.relation && <span className="text-[11px]"> ({c.relation})</span>}
              {c.isDefault && ' ⭐'}
              {c.phone && (
                <>
                  {' · '}
                  <a href={`tel:${c.phone}`} className="text-leaf">
                    {c.phone}
                  </a>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-line bg-white px-4 py-3">
        <Button variant="ghost" sm onClick={onEdit}>
          ✏️ Editar
        </Button>
        <Button variant="wa" sm onClick={onWa}>
          💬 WhatsApp
        </Button>
      </div>
    </div>
  )
}
