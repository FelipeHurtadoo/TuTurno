import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseEnv } from '@/lib/env'

/** Cliente para el NAVEGADOR (usa solo la clave pública; la seguridad la dan RLS y las funciones SQL). */
export function createClient() {
  const { url, key } = getSupabaseEnv()
  return createBrowserClient(url, key)
}
