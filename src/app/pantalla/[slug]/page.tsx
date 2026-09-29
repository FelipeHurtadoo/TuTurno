import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PublicBoard from '@/components/PublicBoard'
import { createPublicClient } from '@/lib/supabase/public'
import { isSlug } from '@/lib/validation'
import type { PublicBoardData } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Pantalla de turnos · TuTurno', robots: { index: false } }

export default async function BoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!isSlug(slug)) notFound()

  const { data, error } = await createPublicClient().rpc('get_public_board', { p_slug: slug })
  if (error) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <p role="alert" className="alert-error">No pudimos cargar la pantalla. Recarga la página.</p>
      </main>
    )
  }
  const board = data as PublicBoardData
  if (!board.found) notFound()

  return <PublicBoard slug={slug} initial={board} />
}
