'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { beep, unlockAudio } from '@/lib/browser-alerts'
import { useQueueSync } from '@/lib/useQueueSync'
import { useOrigin, useQrDataUrl } from '@/components/QrImage'
import type { PublicBoardData } from '@/lib/types'

/** RF07: pantalla para un TV o tablet. Solo muestra NÚMEROS, nunca nombres ni celulares. */
export default function PublicBoard({ slug, initial }: { slug: string; initial: PublicBoardData }) {
  const [board, setBoard] = useState<PublicBoardData>(initial)
  const [sound, setSound] = useState(false)
  const origin = useOrigin()
  const qr = useQrDataUrl(origin ? `${origin}/n/${slug}` : null, 400)
  const prevServing = useRef<number | null | undefined>(initial.now_serving)
  const soundRef = useRef(false)

  useEffect(() => {
    soundRef.current = sound
  }, [sound])

  const refresh = useCallback(async () => {
    const { data, error } = await createClient().rpc('get_public_board', { p_slug: slug })
    if (!error && (data as PublicBoardData)?.found) setBoard(data as PublicBoardData)
  }, [slug])

  const connected = useQueueSync(board.business_id ?? null, refresh)

  // Suena cuando se llama un turno nuevo (requiere activar el sonido con un clic: regla del navegador).
  useEffect(() => {
    if (prevServing.current !== board.now_serving && board.now_serving != null && soundRef.current) beep(2)
    prevServing.current = board.now_serving
  }, [board.now_serving])

  const next = board.next ?? []

  return (
    <main className="flex min-h-screen flex-col bg-slate-900 px-6 py-8 text-white">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold sm:text-4xl">{board.name}</h1>
        <button type="button" className="btn btn-secondary print:hidden"
          onClick={() => { unlockAudio(); setSound((s) => !s) }} aria-pressed={sound}>
          {sound ? '🔊 Sonido activado' : '🔈 Activar sonido'}
        </button>
      </header>

      <section className="my-auto grid items-center gap-10 py-8 lg:grid-cols-[2fr_1fr]" aria-live="polite">
        <div className="text-center">
          <p className="text-2xl uppercase tracking-widest text-slate-300 sm:text-4xl">Turno en atención</p>
          <p className="my-4 text-[9rem] font-extrabold leading-none text-emerald-400 sm:text-[16rem]">
            {board.now_serving ?? '—'}
          </p>
          <p className="text-xl text-slate-300 sm:text-3xl">
            {board.waiting_count === 0 ? 'No hay personas en espera' : `${board.waiting_count} en espera`}
          </p>

          <div className="mt-8">
            <p className="text-lg uppercase tracking-widest text-slate-300 sm:text-2xl">Próximos turnos</p>
            <ul className="mt-3 flex flex-wrap justify-center gap-3">
              {next.length === 0 && <li className="text-slate-400">—</li>}
              {next.map((n) => (
                <li key={n} className="min-w-[4.5rem] rounded-xl bg-slate-700 px-4 py-2 text-3xl font-bold sm:text-5xl">{n}</li>
              ))}
            </ul>
          </div>
        </div>

        <aside className="mx-auto max-w-xs rounded-2xl bg-white p-5 text-center text-slate-900">
          <p className="text-lg font-bold">¿Aún no tienes turno?</p>
          <p className="text-sm text-slate-700">Escanea el código con la cámara de tu celular</p>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`Código QR para tomar turno en ${board.name}`} className="mx-auto mt-3 h-56 w-56" />
          ) : (
            <div className="mx-auto mt-3 h-56 w-56 animate-pulse rounded bg-slate-200" />
          )}
        </aside>
      </section>

      <footer className="text-center text-xs text-slate-400">
        {connected ? 'Actualización en tiempo real' : 'Actualizando cada pocos segundos'} · TuTurno
      </footer>
    </main>
  )
}
