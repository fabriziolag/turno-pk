import { useRef } from 'react'
import { fileToDownscaledDataUrl } from '../lib/photo'

/** Botón para subir/cambiar una foto (la reduce a un dataURL liviano). */
export function PhotoButton({
  value,
  onPick,
  size = 56,
  rounded = 'full',
  placeholder = '📷',
}: {
  value?: string
  onPick: (dataUrl: string) => void
  size?: number
  rounded?: 'full' | 'lg'
  placeholder?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={`grid flex-none place-items-center overflow-hidden border-2 border-dashed border-line bg-panel2 text-ink-soft ${
          rounded === 'full' ? 'rounded-full' : 'rounded-xl'
        }`}
        style={{ width: size, height: size }}
      >
        {value ? <img src={value} alt="" className="size-full object-cover" /> : <span className="text-lg">{placeholder}</span>}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (f) onPick(await fileToDownscaledDataUrl(f))
          e.target.value = ''
        }}
      />
    </>
  )
}
