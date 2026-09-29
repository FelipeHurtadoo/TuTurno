import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import TicketView from '@/components/TicketView'
import { isUuid } from '@/lib/validation'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Tu turno · TuTurno', robots: { index: false } }

export default async function TicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!isUuid(token)) notFound()
  return <TicketView token={token} />
}
