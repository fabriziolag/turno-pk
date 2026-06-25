import { useState, type ReactNode } from 'react'

/** Sección colapsable (acordeón) para opciones secundarias. */
export function Collapsible({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="overflow-hidden rounded-3xl bg-panel shadow-2xl shadow-black/30">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left font-display text-[15px] font-semibold text-leaf"
      >
        <span>{title}</span>
        <span className="text-ink-soft">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  )
}
