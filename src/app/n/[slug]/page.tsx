import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Logo from '@/components/Logo'
import JoinForm from '@/components/JoinForm'
import { createPublicClient } from '@/lib/supabase/public'
import { isSlug } from '@/lib/validation'
import type { JoinInfo } from '@/lib/types'

// Siempre se consulta en cada visita: "accepting" cambia durante el día.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Toma tu turno · TuTurno', robots: { index: false } }

export default async function JoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!isSlug(slug)) notFound()

  const { data, error } = await createPublicClient().rpc('get_join_info', { p_slug: slug })
  if (error) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <p role="alert" className="alert-error">No pudimos cargar el negocio. Revisa tu conexión e inténtalo de nuevo.</p>
      </main>
    )
  }
  const info = data as JoinInfo
  if (!info.found) notFound()

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex justify-center"><Logo /></div>
      <div className="card">
        <p className="text-sm font-medium text-slate-600">Estás a punto de tomar turno en</p>
        <h1 className="mt-1 text-2xl font-bold">{info.name}</h1>
        <p className="mt-2 text-sm text-slate-600">
          No necesitas instalar nada. Verás tu posición en la fila desde este celular y te avisaremos cuando se acerque tu turno.
        </p>
        <div className="mt-5">
          <JoinForm slug={slug} businessName={info.name ?? 'Este negocio'} accepting={!!info.accepting} />
        </div>
      </div>
    </main>
  )
}
