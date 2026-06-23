import { useToast } from './toastStore'

export function Toast() {
  const { msg, type, visible } = useToast()
  const color = type === 'ok' ? 'bg-leaf' : type === 'warn' ? 'bg-clay' : 'bg-ink'
  return (
    <div
      className={`pointer-events-none fixed bottom-6 left-1/2 z-[500] max-w-[90vw] -translate-x-1/2 rounded-xl px-5 py-3 text-center text-sm font-medium text-white shadow-2xl transition-transform duration-300 ${
        visible ? 'translate-y-0' : 'translate-y-40'
      } ${color}`}
    >
      {msg}
    </div>
  )
}
