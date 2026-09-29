import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseEnv } from '@/lib/env'

/**
 * Refresca la sesión y protege /panel.
 *
 * SEGURIDAD: aquí usamos getUser() y NO getSession(). getUser() valida el token contra
 * el servidor de Supabase; getSession() solo lee la cookie, que un atacante podría falsificar.
 * Además, el middleware NO es la única barrera: cada página de /panel vuelve a verificar
 * al usuario, y la base de datos vuelve a verificar el dueño en cada función SQL.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const { url, key } = getSupabaseEnv()

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  let isLoggedIn = false
  try {
    const { data } = await supabase.auth.getUser()
    isLoggedIn = !!data.user
  } catch {
    isLoggedIn = false // si Supabase no responde, se trata como no autenticado (falla cerrado)
  }

  const path = request.nextUrl.pathname
  const redirectTo = (pathname: string) => {
    const target = request.nextUrl.clone()
    target.pathname = pathname
    target.search = ''
    const redirect = NextResponse.redirect(target)
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return redirect
  }

  if (!isLoggedIn && (path.startsWith('/panel') || path.startsWith('/admin'))) return redirectTo('/login')
  if (isLoggedIn && (path === '/login' || path === '/registro')) return redirectTo('/panel')

  return response
}
