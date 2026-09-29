import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import CreateBusinessForm from '@/components/CreateBusinessForm'
import PanelClient from '@/components/PanelClient'
import { createClient } from '@/lib/supabase/server'
import type { AdminSnapshot, Business } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Panel · TuTurno', robots: { index: false } }

export default async function PanelPage() {
  const supabase = await createClient()

  // SEGURIDAD: getUser() valida la sesión con Supabase (getSession() solo lee la cookie y no es de fiar).
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS ya limita esto al negocio del usuario; el .eq es una segunda barrera explícita.
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, slug, plan, daily_limit')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!business) {
    const suggested = typeof user.user_metadata?.business_name === 'string' ? user.user_metadata.business_name : ''
    return <CreateBusinessForm defaultName={suggested} />
  }

  const { data: snapshot, error } = await supabase.rpc('get_admin_snapshot', { p_business_id: business.id })
  if (error || !snapshot) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <p role="alert" className="alert-error">No pudimos cargar tu panel. Recarga la página.</p>
      </main>
    )
  }

  return <PanelClient business={business as Business} initial={snapshot as AdminSnapshot} />
}
