import type { ReactNode } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

export function Modal({ title, onClose, children, footer, wide }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-bg/55 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={`my-auto w-full ${wide ? 'max-w-2xl' : 'max-w-xl'} rounded-3xl bg-panel shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h3 className="font-display text-xl font-semibold text-ink">{title}</h3>
          <button
            onClick={onClose}
            className="grid size-9 place-items-center rounded-lg bg-panel2 text-lg text-ink-soft hover:bg-[#e9e4d3]"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2.5 border-t border-line px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
  )
}
