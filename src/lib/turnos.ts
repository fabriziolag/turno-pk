// Capa de datos de turnos: crear, listar, invitar, aceptar, miembros.
// Toda la seguridad la maneja la RLS (ver supabase/schema_v2.sql).
import { supabase } from './supabase'

export interface Turno {
  id: string
  emoji: string
  name: string
  created_by: string
  school_name: string
  school_text: string
  school_region: string
  school_comuna: string
  school_extra: string
  school_lat: number | null
  school_lng: number | null
  exit_times: Record<string, string>
}
export type MyTurno = Turno & { myKidIds: string[] }

export async function updateTurnoSettings(turnoId: string, patch: Partial<Turno>): Promise<void> {
  const { error } = await db().from('turnos').update(patch).eq('id', turnoId)
  if (error) throw error
}

export interface PendingInvite {
  id: string
  turno_id: string
  email: string
  turno: { emoji: string; name: string } | null
}

export interface TurnoMemberView {
  family_id: string
  fam_name: string
  kids: { id: string; name: string }[] // hijos que participan en este turno
}

function db() {
  if (!supabase) throw new Error('Supabase no configurado')
  return supabase
}

/** Turnos en los que participa mi familia (+ qué hijos míos van en cada uno). */
export async function getMyTurnos(myFamilyId: string): Promise<MyTurno[]> {
  const { data, error } = await db()
    .from('turno_members')
    .select('kid_ids, turnos(*)')
    .eq('family_id', myFamilyId)
  if (error) throw error
  return (data ?? [])
    .filter((r) => r.turnos)
    .map((r) => ({ ...(r.turnos as unknown as Turno), myKidIds: (r.kid_ids as string[]) ?? [] }))
}

/** Crea un turno y mete a mi familia como primer miembro con los hijos elegidos. */
export async function createTurno(
  userId: string,
  emoji: string,
  name: string,
  familyId: string,
  kidIds: string[],
): Promise<Turno> {
  const { data: t, error } = await db()
    .from('turnos')
    .insert({ emoji, name: name.trim(), created_by: userId })
    .select('*')
    .single()
  if (error) throw error
  const turno = t as Turno
  const { error: me } = await db()
    .from('turno_members')
    .insert({ turno_id: turno.id, family_id: familyId, kid_ids: kidIds })
  if (me) throw me
  return turno
}

/** Invitaciones pendientes dirigidas a mi correo. */
export async function getPendingInvites(email: string): Promise<PendingInvite[]> {
  const { data, error } = await db()
    .from('turno_invites')
    .select('id, turno_id, email, turnos(emoji,name)')
    .eq('status', 'pending')
    .eq('email', email.toLowerCase())
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    turno_id: r.turno_id as string,
    email: r.email as string,
    turno: (r.turnos as unknown as { emoji: string; name: string } | null) ?? null,
  }))
}

/** Acepta una invitación: une a mi familia al turno con los hijos elegidos. */
export async function acceptInvite(
  inviteId: string,
  turnoId: string,
  familyId: string,
  kidIds: string[],
): Promise<void> {
  const { error: me } = await db()
    .from('turno_members')
    .insert({ turno_id: turnoId, family_id: familyId, kid_ids: kidIds })
  if (me) throw me
  const { error: ue } = await db().from('turno_invites').update({ status: 'accepted' }).eq('id', inviteId)
  if (ue) throw ue
}

/** Invita una familia al turno por correo (cualquier miembro con perfil completo). */
export async function inviteToTurno(turnoId: string, email: string, invitedBy: string): Promise<void> {
  const { error } = await db()
    .from('turno_invites')
    .upsert(
      { turno_id: turnoId, email: email.trim().toLowerCase(), invited_by: invitedBy, status: 'pending' },
      { onConflict: 'turno_id,email' },
    )
  if (error) throw error
}

/** Familias del turno + qué hijos de cada una participan. */
export async function getTurnoMembers(turnoId: string): Promise<TurnoMemberView[]> {
  const { data: tm, error } = await db()
    .from('turno_members')
    .select('family_id, kid_ids')
    .eq('turno_id', turnoId)
  if (error) throw error
  const rows = tm ?? []
  const famIds = rows.map((r) => r.family_id as string)
  if (!famIds.length) return []
  const [{ data: fams }, { data: kids }] = await Promise.all([
    db().from('families').select('id, fam_name').in('id', famIds),
    db().from('kids').select('id, family_id, name').in('family_id', famIds),
  ])
  const famName = new Map((fams ?? []).map((f) => [f.id as string, f.fam_name as string]))
  return rows.map((r) => {
    const kidIds = new Set((r.kid_ids as string[]) ?? [])
    return {
      family_id: r.family_id as string,
      fam_name: famName.get(r.family_id as string) ?? '—',
      kids: (kids ?? [])
        .filter((k) => k.family_id === r.family_id && kidIds.has(k.id as string))
        .map((k) => ({ id: k.id as string, name: k.name as string })),
    }
  })
}

/** Invitaciones aún pendientes de un turno (para mostrar al miembro). */
export async function getTurnoPendingInvites(turnoId: string): Promise<{ id: string; email: string }[]> {
  const { data, error } = await db()
    .from('turno_invites')
    .select('id, email')
    .eq('turno_id', turnoId)
    .eq('status', 'pending')
  if (error) throw error
  return (data ?? []).map((r) => ({ id: r.id as string, email: r.email as string }))
}

/** Cambia qué hijos míos participan en un turno. */
export async function updateMyKids(turnoId: string, familyId: string, kidIds: string[]): Promise<void> {
  const { error } = await db()
    .from('turno_members')
    .update({ kid_ids: kidIds })
    .eq('turno_id', turnoId)
    .eq('family_id', familyId)
  if (error) throw error
}
