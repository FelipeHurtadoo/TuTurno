import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Poster from '@/components/Poster'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Código QR · TuTurno', robots: { index: false } }

export default async function PosterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('name, slug')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!business) redirect('/panel')

  return <Poster businessName={business.name} slug={business.slug} />
}
