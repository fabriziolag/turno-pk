import { Button } from '../../components/ui'
import type { MyContext } from '../../lib/identity'
import { signOut } from '../../lib/identity'

/**
 * Pantalla post-onboarding (Fase 1). Muestra tu perfil + familia.
 * En la Fase 3 aquí entran los turnos (crear / unirse / switcher).
 */
export function OnboardedHome({ ctx }: { ctx: MyContext }) {
  const { profile, family, kids } = ctx
  return (
    <div className="min-h-dvh px-4 py-8">
      <div className="mx-auto w-full max-w-lg rounded-3xl bg-panel p-6 shadow-2xl shadow-black/30">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-gold to-gold-deep text-xl shadow-lg shadow-gold/30">
            🚐
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold leading-none text-ink">
              ¡Hola, {profile.name || 'apoderado'}!
            </h1>
            <div className="mt-1 text-[11.5px] text-ink-soft">{profile.email}</div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-line bg-panel2 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Tu familia</div>
          <div className="mt-1 font-display text-lg font-semibold text-ink">
            Familia {family?.fam_name || '—'}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {kids.length ? (
              kids.map((k) => (
                <span key={k.id} className="rounded-md bg-leaf/15 px-2 py-0.5 text-xs font-semibold text-leaf">
                  {k.name}
                </span>
              ))
            ) : (
              <span className="text-xs text-ink-soft">Sin hijos cargados</span>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-dashed border-gold bg-[#fbf3da] p-5 text-center">
          <div className="text-3xl">📅</div>
          <div className="mt-2 font-display text-base font-semibold text-[#6b551d]">Próximamente: tus turnos</div>
          <p className="mt-1 text-[13px] leading-relaxed text-[#6b551d]">
            Ya tienes tu perfil listo. El siguiente paso (en construcción) es <b>crear un turno</b>
            {' '}(con emoji y nombre) e <b>invitar a otras familias</b>.
          </p>
        </div>

        <Button variant="ghost" className="mt-5 w-full" onClick={() => void signOut()}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  )
}
