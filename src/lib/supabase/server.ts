import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseEnv } from '@/lib/env'

/** Cliente para Server Components: lee la sesión del administrador desde las cookies. */
export async function createClient() {
  const cookieStore = await cookies()
  const { url, key } = getSupabaseEnv()

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Desde un Server Component no se pueden escribir cookies; el middleware ya refresca la sesión.
        }
      },
    },
  })
}
