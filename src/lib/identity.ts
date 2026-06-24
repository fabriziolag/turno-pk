// Capa de datos de identidad v2: perfiles, familias, hijos, direcciones.
// Relacional en Supabase (RLS). Ver supabase/schema_v2.sql.
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface Profile {
  id: string
  email: string
  name: string
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
  lat: number | null
  lng: number | null
  sort: number
}

export interface MyContext {
  profile: Profile
  family: Family | null
  kids: Kid[]
  addresses: AddressRow[]
}

/** Asegura que exista una fila profiles para el usuario (la crea al primer login). */
export async function ensureProfile(user: User): Promise<Profile> {
  if (!supabase) throw new Error('Supabase no configurado')
  const email = (user.email ?? '').toLowerCase()
  const { data: existing } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (existing) return existing as Profile
  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: user.id, email })
    .select('*')
    .single()
  if (error) throw error
  return data as Profile
}

/** Trae mi perfil + mi familia (vía family_members) + hijos + direcciones. */
export async function getMyContext(userId: string): Promise<MyContext | null> {
  if (!supabase) return null
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (!profile) return null

  const { data: fm } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('profile_id', userId)
    .limit(1)
    .maybeSingle()

  let family: Family | null = null
  let kids: Kid[] = []
  let addresses: AddressRow[] = []
  if (fm?.family_id) {
    const famId = fm.family_id as string
    const [{ data: fam }, { data: k }, { data: a }] = await Promise.all([
      supabase.from('families').select('*').eq('id', famId).maybeSingle(),
      supabase.from('kids').select('*').eq('family_id', famId).order('sort'),
      supabase.from('addresses').select('*').eq('family_id', famId).order('sort'),
    ])
    family = (fam as Family) ?? null
    kids = (k as Kid[]) ?? []
    addresses = (a as AddressRow[]) ?? []
  }
  return { profile: profile as Profile, family, kids, addresses }
}

export interface OnboardingInput {
  name: string
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
 * Completa el perfil mínimo: actualiza el perfil, crea la familia + me vincula
 * como apoderado + agrega hijos + dirección, y marca onboarded=true.
 * El orden importa por RLS (familia → membresía → hijos/dirección).
 */
export async function completeOnboarding(userId: string, input: OnboardingInput): Promise<void> {
  if (!supabase) throw new Error('Supabase no configurado')

  const { error: pe } = await supabase
    .from('profiles')
    .update({ name: input.name.trim(), phone: input.phone.trim() })
    .eq('id', userId)
  if (pe) throw pe

  // Generamos el id en el cliente: insertar y RE-LEER la familia chocaría con la
  // RLS (aún no existe la membresía que da permiso de lectura). Con id propio no
  // hace falta leerla de vuelta.
  const familyId = crypto.randomUUID()
  const { error: fe } = await supabase
    .from('families')
    .insert({ id: familyId, fam_name: input.famName.trim(), created_by: userId })
  if (fe) throw fe

  const { error: me } = await supabase
    .from('family_members')
    .insert({ family_id: familyId, profile_id: userId })
  if (me) throw me

  const kidRows = input.kids
    .filter((k) => k.name.trim())
    .map((k, i) => ({ family_id: familyId, name: k.name.trim(), sort: i }))
  if (kidRows.length) {
    const { error } = await supabase.from('kids').insert(kidRows)
    if (error) throw error
  }

  const a = input.address
  const { error: ae } = await supabase.from('addresses').insert({
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

  const { error: oe } = await supabase.from('profiles').update({ onboarded: true }).eq('id', userId)
  if (oe) throw oe
}

export async function signOut() {
  await supabase?.auth.signOut()
}
