import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

// Solo corre donde hay sesión de administrador; las páginas públicas de clientes no pasan por aquí.
export const config = {
  matcher: ['/panel/:path*', '/login', '/registro'],
}
