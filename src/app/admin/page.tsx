import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import AdminClient from '@/components/AdminClient'
import { createClient } from '@/lib/supabase/server'
import type { SuperAdminBusiness } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Super admin · TuTurno', robots: { index: false } }

export default async function AdminPage() {
  const supabase = await createClient()

  // SEGURIDAD: getUser() valida la sesión con Supabase (getSession() solo lee la cookie y no es de fiar).
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // La tabla super_admins no tiene políticas de lectura: el permiso real lo valida
  // admin_list_businesses() dentro de la función (_assert_super_admin). Si el usuario
  // no es super admin, el RPC devuelve el error SIN_PERMISO y lo mandamos de vuelta a su panel.
  const { data: businesses, error } = await supabase.rpc('admin_list_businesses')
  if (error) {
    if (error.message.includes('SIN_PERMISO')) redirect('/panel')
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <p role="alert" className="alert-error">No pudimos cargar el panel de super admin. Recarga la página.</p>
      </main>
    )
  }

  return <AdminClient initial={(businesses ?? []) as SuperAdminBusiness[]} />
}
