import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getSupabaseEnv } from '@/lib/env'

/** Cliente ANÓNIMO sin sesión, para páginas públicas (ingreso a la fila, pantalla). */
export function createPublicClient() {
  const { url, key } = getSupabaseEnv()
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
