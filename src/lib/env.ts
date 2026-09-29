// Importante: Next.js solo "incrusta" las variables NEXT_PUBLIC_* si se leen con este
// formato literal (process.env.NEXT_PUBLIC_X). No las leas con process.env[nombre].
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL y/o NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Copia .env.example a .env.local, complétalas y reinicia "npm run dev".'
    )
  }
  return { url, key }
}
