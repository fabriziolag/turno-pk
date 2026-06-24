import type { Kid } from '../../lib/identity'

/** Lista de mis hijos con checkboxes para elegir cuáles participan. */
export function KidPicker({
  kids,
  selected,
  onChange,
}: {
  kids: Kid[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  if (!kids.length) return <p className="text-xs text-ink-soft">No tienes hijos cargados en tu familia.</p>
  return (
    <div className="space-y-2">
      {kids.map((k) => (
        <label
          key={k.id}
          className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-line bg-white p-2.5"
        >
          <input
            type="checkbox"
            checked={selected.includes(k.id)}
            onChange={() => toggle(k.id)}
            className="size-4 accent-leaf"
          />
          <span className="text-sm font-semibold text-ink">{k.name}</span>
        </label>
      ))}
    </div>
  )
}
