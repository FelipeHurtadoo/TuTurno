'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import Logo from './Logo'
import { useOrigin } from './QrImage'
import { createClient } from '@/lib/supabase/client'
import { friendlyError, isAuthError } from '@/lib/errors'
import { formatDuration, formatTime } from '@/lib/format'
import { useQueueSync } from '@/lib/useQueueSync'
import { manualTicketSchema } from '@/lib/validation'
import type { AdminSnapshot, AdminTicket, Business } from '@/lib/types'

interface Props {
  business: Business
  initial: AdminSnapshot
}

type Result = PromiseLike<{ error: { message: string } | null }>

export default function PanelClient({ business, initial }: Props) {
  const router = useRouter()
  const origin = useOrigin()
  const [snap, setSnap] = useState<AdminSnapshot>(initial)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null)
  const [manualName, setManualName] = useState('')
  const [manualPhone, setManualPhone] = useState('')

  const handleError = useCallback(
    (raw: string) => {
      if (isAuthError(raw)) {
        router.push('/login')
        return
      }
      setMessage({ kind: 'error', text: friendlyError(raw) })
    },
    [router]
  )

  const refresh = useCallback(async () => {
    const { data, error } = await createClient().rpc('get_admin_snapshot', { p_business_id: business.id })
    if (error) return handleError(error.message)
    setSnap(data as AdminSnapshot)
  }, [business.id, handleError])

  const connected = useQueueSync(business.id, refresh)

  async function run(action: () => Result, okText?: string) {
    setBusy(true)
    setMessage(null)
    const { error } = await action()
    if (error) handleError(error.message)
    else if (okText) setMessage({ kind: 'ok', text: okText })
    await refresh()
    setBusy(false)
  }

  const supabase = createClient()
  const callNext = (resolve?: 'attended' | 'absent') =>
    run(() => supabase.rpc('call_next', { p_business_id: business.id, p_resolve_current: resolve ?? null }))
  const resolveTicket = (t: AdminTicket, status: 'attended' | 'absent' | 'cancelled') =>
    run(() => supabase.rpc('resolve_ticket', { p_ticket_id: t.id, p_status: status }))

  async function onAddManual(e: React.FormEvent) {
    e.preventDefault()
    const parsed = manualTicketSchema.safeParse({ name: manualName, phone: manualPhone })
    if (!parsed.success) return setMessage({ kind: 'error', text: parsed.error.issues[0].message })
    await run(
      () => supabase.rpc('admin_add_ticket', {
        p_business_id: business.id, p_name: parsed.data.name, p_phone: parsed.data.phone ?? null,
      }),
      `Turno agregado para ${parsed.data.name}.`
    )
    setManualName('')
    setManualPhone('')
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const { stats, tickets } = snap
  const current = useMemo(() => tickets.find((t) => t.status === 'called'), [tickets])
  const waiting = useMemo(() => tickets.filter((t) => t.status === 'waiting'), [tickets])
  const finished = useMemo(() => tickets.filter((t) => ['attended', 'absent', 'cancelled'].includes(t.status)).reverse(), [tickets])
  const joinUrl = origin ? `${origin}/n/${business.slug}` : ''

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-4">
            <Logo href="/panel" />
            <span className="hidden text-slate-400 sm:inline">|</span>
            <span className="font-semibold">{business.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${stats.plan === 'free' ? 'bg-slate-200 text-slate-800' : 'bg-indigo-100 text-indigo-800'}`}>
              Plan {stats.plan === 'free' ? 'gratuito' : 'Pro'}
            </span>
          </div>
          <nav className="flex flex-wrap items-center gap-2" aria-label="Acciones del negocio">
            <Link href={`/pantalla/${business.slug}`} target="_blank" className="btn btn-secondary">Pantalla pública</Link>
            <Link href="/panel/afiche" className="btn btn-secondary">Código QR</Link>
            <button type="button" onClick={signOut} className="btn btn-secondary">Cerrar sesión</button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <p className="text-sm text-slate-600" aria-live="polite">
          {connected ? '🟢 Conectado en tiempo real' : '🟡 Actualizando cada pocos segundos'}
        </p>

        {message && (
          <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? 'alert-error' : 'alert-ok'}>
            {message.text}
          </p>
        )}

        {/* RF09: estadísticas del día */}
        <section aria-label="Estadísticas de hoy" className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="En espera" value={stats.waiting} />
          <Stat label="Atendidos" value={stats.attended} />
          <Stat label="Ausentes" value={stats.absent} />
          <Stat label="Espera promedio" value={formatDuration(stats.avg_wait_seconds)} />
          <Stat label="Turnos hoy" value={stats.daily_limit ? `${stats.issued} / ${stats.daily_limit}` : stats.issued} />
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-6">
            {/* RF05 / RF06: turno en atención y acciones */}
            <section className="card" aria-label="Turno en atención">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">En atención</h2>
              {current ? (
                <>
                  <p className="mt-1 text-7xl font-extrabold text-emerald-700">{current.number}</p>
                  <p className="text-lg font-semibold">{current.customer_name}</p>
                  {current.customer_phone && <p className="text-sm text-slate-600">{current.customer_phone}</p>}
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <button type="button" className="btn btn-success" disabled={busy} onClick={() => resolveTicket(current, 'attended')}>✔ Atendido</button>
                    <button type="button" className="btn btn-danger" disabled={busy} onClick={() => resolveTicket(current, 'absent')}>✖ Ausente</button>
                    <button type="button" className="btn btn-primary sm:col-span-2" disabled={busy || waiting.length === 0} onClick={() => callNext('attended')}>
                      Atendido y llamar siguiente →
                    </button>
                    <button type="button" className="btn btn-secondary sm:col-span-2" disabled={busy || waiting.length === 0} onClick={() => callNext('absent')}>
                      Ausente y llamar siguiente →
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-1 text-slate-600">Nadie en atención en este momento.</p>
                  <button type="button" className="btn btn-primary mt-4 w-full text-base" disabled={busy || waiting.length === 0} onClick={() => callNext()}>
                    Llamar siguiente
                  </button>
                  {waiting.length === 0 && <p className="mt-2 text-sm text-slate-600">No hay turnos en espera.</p>}
                </>
              )}
            </section>

            {/* R9: cliente sin celular */}
            <section className="card" aria-label="Agregar turno manual">
              <h2 className="font-semibold">Agregar cliente sin celular</h2>
              <p className="text-sm text-slate-600">Para quien no tiene cámara o datos: le das un turno tú mismo.</p>
              <form onSubmit={onAddManual} className="mt-3 space-y-3" noValidate>
                <div>
                  <label htmlFor="mname" className="label">Nombre</label>
                  <input id="mname" className="input" value={manualName} maxLength={60} onChange={(e) => setManualName(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="mphone" className="label">Celular (opcional)</label>
                  <input id="mphone" type="tel" inputMode="tel" className="input" value={manualPhone} maxLength={20} onChange={(e) => setManualPhone(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-secondary w-full" disabled={busy}>Agregar a la fila</button>
              </form>
            </section>

            <section className="card" aria-label="Enlace para clientes">
              <h2 className="font-semibold">Enlace para tus clientes</h2>
              <p className="mt-1 break-all rounded bg-slate-100 px-2 py-1 text-sm">{joinUrl || '…'}</p>
              <button type="button" className="btn btn-secondary mt-3 w-full" disabled={!joinUrl}
                onClick={() => navigator.clipboard?.writeText(joinUrl).then(() => setMessage({ kind: 'ok', text: 'Enlace copiado.' }))}>
                Copiar enlace
              </button>
            </section>
          </div>

          <div className="space-y-6">
            <section className="card" aria-label="Fila de espera">
              <h2 className="font-semibold">Fila de espera ({waiting.length})</h2>
              {waiting.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">La fila está vacía.</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-200">
                  {waiting.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div>
                        <span className="mr-2 inline-block min-w-[2.5rem] rounded bg-indigo-100 px-2 py-0.5 text-center font-bold text-indigo-800">{t.number}</span>
                        <span className="font-medium">{t.customer_name}</span>
                        <span className="ml-2 text-xs text-slate-600">
                          {formatTime(t.created_at)}{t.source === 'manual' ? ' · manual' : ''}{t.customer_phone ? ` · ${t.customer_phone}` : ''}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" className="btn btn-secondary !min-h-[36px] !px-3" disabled={busy} onClick={() => resolveTicket(t, 'absent')}>Ausente</button>
                        <button type="button" className="btn btn-danger !min-h-[36px] !px-3" disabled={busy}
                          onClick={() => window.confirm(`¿Quitar el turno ${t.number} (${t.customer_name}) de la fila?`) && resolveTicket(t, 'cancelled')}>
                          Quitar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card" aria-label="Turnos finalizados hoy">
              <h2 className="font-semibold">Finalizados hoy ({finished.length})</h2>
              {finished.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">Aún no hay turnos finalizados.</p>
              ) : (
                <ul className="mt-3 max-h-72 divide-y divide-slate-200 overflow-y-auto">
                  {finished.map((t) => (
                    <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                      <span><strong>{t.number}</strong> · {t.customer_name}</span>
                      <span className={t.status === 'attended' ? 'text-emerald-800' : t.status === 'absent' ? 'text-amber-800' : 'text-slate-600'}>
                        {t.status === 'attended' ? 'Atendido' : t.status === 'absent' ? 'Ausente' : 'Cancelado'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card !p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}
