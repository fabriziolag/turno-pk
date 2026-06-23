import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Hay conexión a Supabase configurada (env presentes). */
export const hasSupabase = Boolean(url && anon)

/**
 * Cliente de Supabase, o null si todavía no hay credenciales.
 * Mientras no exista el proyecto, la app corre en modo local (localStorage).
 */
export const supabase: SupabaseClient | null = hasSupabase
  ? createClient(url!, anon!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null
