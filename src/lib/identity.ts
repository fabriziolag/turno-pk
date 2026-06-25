// Capa de datos de identidad v2: perfiles, familias (multi-apoderado), hijos, direcciones.
// Relacional en Supabase (RLS). Ver supabase/schema_v2.sql + schema_v2_coparents.sql.
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface Profile {
  id: string
  email: string
  name: string // nombre (de pila)
  apellido: string
  photo: string
  phone: string
  onboarded: boolean
}
export interface Family {
  id: string
  fam_name: string
  created_by: string
}
export interface Kid {
  id: string
  family_id: string
  name: string
  photo: string
  sort: number
}
export interface AddressRow {
  id: string
  family_id: string
  label: string
  text: string
  region: string
  comuna: string
  extra: string
  house_photo: string
  lat: number | null
  lng: number | null
  sort: number
}
export interface CoParent {
  profile_id: string
  name: string
  apellido: string
  email: string
  role: string
}
export interface Contact {
  id: string
  family_id: string
  name: string
  relation: string
  phone: string
  is_default: boolean
  photo: string
}

export interface MyContext {
  profile: Profile
  family: Family | null
  kids: Kid[]
  addresses: AddressRow[]
  contacts: Contact[]
  coParents: CoParent[]
  pendingCoParents: { id: string; email: string }[]
  myRole: string
}

function db() {
  if (!supabase) throw new Error('Supabase no configurado')
  return supabase
}

/** Asegura que exista una fila profiles para el usuario (la crea al primer login). */
export async function ensureProfile(user: User): Promise<Profile> {
  const email = (user.email ?? '').toLowerCase()
  const { data: existing } = await db().from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (existing) return existing as Profile
  const { data, error } = await db().from('profiles').insert({ id: user.id, email }).select('*').single()
  if (error) throw error
  return data as Profile
}

/** Mi perfil + mi familia + hijos + direcciones + co-apoderados. */
export async function getMyContext(userId: string): Promise<MyContext | null> {
  const { data: profile } = await db().from('profiles').select('*').eq('id', userId).maybeSingle()
  if (!profile) return null

  const { data: mine } = await db()
    .from('family_members')
    .select('family_id, role')
    .eq('profile_id', userId)
    .limit(1)
    .maybeSingle()

  let family: Family | null = null
  let kids: Kid[] = []
  let addresses: AddressRow[] = []
  let contacts: Contact[] = []
  let coParents: CoParent[] = []
  let pendingCoParents: { id: string; email: string }[] = []
  const myRole = (mine?.role as string) ?? ''

  if (mine?.family_id) {
    const famId = mine.family_id as string
    const [{ data: fam }, { data: k }, { data: a }, { data: c }, { data: members }, { data: inv }] =
      await Promise.all([
        db().from('families').select('*').eq('id', famId).maybeSingle(),
        db().from('kids').select('*').eq('family_id', famId).order('sort'),
        db().from('addresses').select('*').eq('family_id', famId).order('sort'),
        db().from('contacts').select('*').eq('family_id', famId),
        db().from('family_members').select('profile_id, role').eq('family_id', famId),
        db().from('family_invites').select('id, email').eq('family_id', famId).eq('status', 'pending'),
      ])
    family = (fam as Family) ?? null
    kids = (k as Kid[]) ?? []
    addresses = (a as AddressRow[]) ?? []
    contacts = (c as Contact[]) ?? []
    pendingCoParents = (inv ?? []) as { id: string; email: string }[]

    const memberRows = (members ?? []) as { profile_id: string; role: string }[]
    const ids = memberRows.map((m) => m.profile_id)
    let profs: { id: string; name: string; apellido: string; email: string }[] = []
    if (ids.length) {
      const { data } = await db().from('profiles').select('id, name, apellido, email').in('id', ids)
      profs = (data ?? []) as typeof profs
    }
    const byId = new Map(profs.map((p) => [p.id, p]))
    coParents = memberRows.map((m) => {
      const p = byId.get(m.profile_id)
      return {
        profile_id: m.profile_id,
        role: m.role,
        name: (p?.name as string) ?? '',
        apellido: (p?.apellido as string) ?? '',
        email: (p?.email as string) ?? '',
      }
    })
  }
  return { profile: profile as Profile, family, kids, addresses, contacts, coParents, pendingCoParents, myRole }
}

export interface OnboardingInput {
  nombre: string
  apellido: string
  role: string // 'padre' | 'madre' | ...
  phone: string
  famName: string
  kids: { name: string }[]
  address: {
    text: string
    region: string
    comuna: string
    extra: string
    lat: number | null
    lng: number | null
  }
}

/**
 * Crea perfil mínimo + familia + me vincula (con rol) + hijos + dirección.
 * Devuelve el id de la familia (para invitar al cónyuge si corresponde).
 * El orden importa por RLS (familia → membresía → hijos/dirección).
 */
export async function completeOnboarding(userId: string, input: OnboardingInput): Promise<string> {
  const { error: pe } = await db()
    .from('profiles')
    .update({ name: input.nombre.trim(), apellido: input.apellido.trim(), phone: input.phone.trim() })
    .eq('id', userId)
  if (pe) throw pe

  const familyId = crypto.randomUUID()
  const { error: fe } = await db()
    .from('families')
    .insert({ id: familyId, fam_name: input.famName.trim(), created_by: userId })
  if (fe) throw fe

  const { error: me } = await db()
    .from('family_members')
    .insert({ family_id: familyId, profile_id: userId, role: input.role })
  if (me) throw me

  const kidRows = input.kids
    .filter((k) => k.name.trim())
    .map((k, i) => ({ family_id: familyId, name: k.name.trim(), sort: i }))
  if (kidRows.length) {
    const { error } = await db().from('kids').insert(kidRows)
    if (error) throw error
  }

  const a = input.address
  if (a.text.trim()) {
    const { error: ae } = await db().from('addresses').insert({
      family_id: familyId,
      label: 'Casa',
      text: a.text.trim(),
      region: a.region,
      comuna: a.comuna,
      extra: a.extra.trim(),
      lat: a.lat,
      lng: a.lng,
      sort: 0,
    })
    if (ae) throw ae
  }

  const { error: oe } = await db().from('profiles').update({ onboarded: true }).eq('id', userId)
  if (oe) throw oe
  return familyId
}

// ---------- Co-apoderados (cónyuge) ----------

export interface FamilyInvite {
  id: string
  family_id: string
  inviter_name: string
  fam_name: string
}

export async function inviteCoParent(
  familyId: string,
  email: string,
  inviterName: string,
  famName: string,
): Promise<void> {
  const { error } = await db()
    .from('family_invites')
    .upsert(
      {
        family_id: familyId,
        email: email.trim().toLowerCase(),
        inviter_name: inviterName,
        fam_name: famName,
        status: 'pending',
      },
      { onConflict: 'family_id,email' },
    )
  if (error) throw error
}

export async function getPendingFamilyInvites(email: string): Promise<FamilyInvite[]> {
  const { data, error } = await db()
    .from('family_invites')
    .select('id, family_id, inviter_name, fam_name')
    .eq('status', 'pending')
    .eq('email', email.toLowerCase())
  if (error) throw error
  return (data ?? []) as FamilyInvite[]
}

/** Aceptar invitación de co-apoderado: me uno a la familia y quedo onboarded. */
export async function acceptFamilyInvite(
  invite: FamilyInvite,
  userId: string,
  nombre: string,
  apellido: string,
  role: string,
): Promise<void> {
  const { error: pe } = await db()
    .from('profiles')
    .update({ name: nombre.trim(), apellido: apellido.trim(), onboarded: true })
    .eq('id', userId)
  if (pe) throw pe
  const { error: me } = await db()
    .from('family_members')
    .insert({ family_id: invite.family_id, profile_id: userId, role })
  if (me) throw me
  const { error: ue } = await db().from('family_invites').update({ status: 'accepted' }).eq('id', invite.id)
  if (ue) throw ue
}

export async function getMyFamilyPendingCoParents(familyId: string): Promise<{ id: string; email: string }[]> {
  const { data, error } = await db()
    .from('family_invites')
    .select('id, email')
    .eq('family_id', familyId)
    .eq('status', 'pending')
  if (error) throw error
  return (data ?? []) as { id: string; email: string }[]
}

// ---------- Edición ----------

export async function updateMe(
  userId: string,
  familyId: string,
  patch: { nombre: string; apellido: string; phone: string; role: string },
): Promise<void> {
  const { error: pe } = await db()
    .from('profiles')
    .update({ name: patch.nombre.trim(), apellido: patch.apellido.trim(), phone: patch.phone.trim() })
    .eq('id', userId)
  if (pe) throw pe
  const { error: re } = await db()
    .from('family_members')
    .update({ role: patch.role })
    .eq('family_id', familyId)
    .eq('profile_id', userId)
  if (re) throw re
}

export async function updateFamilyName(familyId: string, famName: string): Promise<void> {
  const { error } = await db().from('families').update({ fam_name: famName.trim() }).eq('id', familyId)
  if (error) throw error
}

export async function addKid(familyId: string, name: string, sort: number): Promise<void> {
  const { error } = await db().from('kids').insert({ family_id: familyId, name: name.trim(), sort })
  if (error) throw error
}
export async function renameKid(kidId: string, name: string): Promise<void> {
  const { error } = await db().from('kids').update({ name: name.trim() }).eq('id', kidId)
  if (error) throw error
}
export async function removeKid(kidId: string): Promise<void> {
  const { error } = await db().from('kids').delete().eq('id', kidId)
  if (error) throw error
}

export async function upsertAddress(
  familyId: string,
  addrId: string | null,
  a: { text: string; region: string; comuna: string; extra: string; lat: number | null; lng: number | null },
): Promise<void> {
  const row = {
    family_id: familyId,
    label: 'Casa',
    text: a.text.trim(),
    region: a.region,
    comuna: a.comuna,
    extra: a.extra.trim(),
    lat: a.lat,
    lng: a.lng,
    sort: 0,
  }
  const q = addrId
    ? db().from('addresses').update(row).eq('id', addrId)
    : db().from('addresses').insert(row)
  const { error } = await q
  if (error) throw error
}

// ---------- Fotos ----------
export async function setProfilePhoto(userId: string, photo: string): Promise<void> {
  const { error } = await db().from('profiles').update({ photo }).eq('id', userId)
  if (error) throw error
}
export async function setKidPhoto(kidId: string, photo: string): Promise<void> {
  const { error } = await db().from('kids').update({ photo }).eq('id', kidId)
  if (error) throw error
}
export async function setAddressPhoto(addrId: string, house_photo: string): Promise<void> {
  const { error } = await db().from('addresses').update({ house_photo }).eq('id', addrId)
  if (error) throw error
}
export async function setContactPhoto(contactId: string, photo: string): Promise<void> {
  const { error } = await db().from('contacts').update({ photo }).eq('id', contactId)
  if (error) throw error
}

// ---------- Direcciones (múltiples) ----------
export interface AddressInput {
  label: string
  text: string
  region: string
  comuna: string
  extra: string
  lat: number | null
  lng: number | null
}
export async function addAddress(familyId: string, a: AddressInput, sort: number): Promise<void> {
  const { error } = await db()
    .from('addresses')
    .insert({ family_id: familyId, ...trimAddr(a), sort })
  if (error) throw error
}
export async function updateAddress(addrId: string, a: AddressInput): Promise<void> {
  const { error } = await db().from('addresses').update(trimAddr(a)).eq('id', addrId)
  if (error) throw error
}
export async function removeAddress(addrId: string): Promise<void> {
  const { error } = await db().from('addresses').delete().eq('id', addrId)
  if (error) throw error
}
function trimAddr(a: AddressInput) {
  return {
    label: a.label.trim() || 'Casa',
    text: a.text.trim(),
    region: a.region,
    comuna: a.comuna,
    extra: a.extra.trim(),
    lat: a.lat,
    lng: a.lng,
  }
}

// ---------- Contactos de la casa ----------
export interface ContactInput {
  name: string
  relation: string
  phone: string
  is_default: boolean
}
export async function addContact(familyId: string, c: ContactInput): Promise<void> {
  const { error } = await db()
    .from('contacts')
    .insert({ family_id: familyId, name: c.name.trim(), relation: c.relation.trim(), phone: c.phone.trim(), is_default: c.is_default })
  if (error) throw error
}
export async function updateContact(id: string, c: ContactInput): Promise<void> {
  const { error } = await db()
    .from('contacts')
    .update({ name: c.name.trim(), relation: c.relation.trim(), phone: c.phone.trim(), is_default: c.is_default })
    .eq('id', id)
  if (error) throw error
}
export async function removeContact(id: string): Promise<void> {
  const { error } = await db().from('contacts').delete().eq('id', id)
  if (error) throw error
}

export async function signOut() {
  await supabase?.auth.signOut()
}
