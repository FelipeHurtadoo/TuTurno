'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/errors'
import { formatDuration } from '@/lib/format'
import { getAlert, NEAR_THRESHOLD, type AlertKind, type AlertState } from '@/lib/notify'
import { useQueueSync } from '@/lib/useQueueSync'
import {
  beep, enableNotifications, getNotifState, showSystemNotification, unlockAudio, vibrate, type NotifState,
} from '@/lib/browser-alerts'
import type { TicketStatusResult } from '@/lib/types'

const FINAL = ['attended', 'absent', 'cancelled']

export default function TicketView({ token }: { token: string }) {
  const [snap, setSnap] = useState<TicketStatusResult | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [banner, setBanner] = useState<AlertKind | null>(null)
  const [notif, setNotif] = useState<NotifState>('default')
  const [leaving, setLeaving] = useState(false)
  const alerted = useRef<AlertState>({ near: false, called: false })

  const refresh = useCallback(async () => {
    const { data, error } = await createClient().rpc('get_ticket_status', { p_token: token })
    if (error) {
      setLoadError(friendlyError(error.message))
      return
    }
    setLoadError(null)
    setSnap(data as TicketStatusResult)
  }, [token])

  useEffect(() => {
    setNotif(getNotifState())
    void refresh()
  }, [refresh])

  const isFinal = !!snap && (!snap.found || snap.expired || FINAL.includes(snap.status ?? ''))
  const connected = useQueueSync(snap?.business_id ?? null, refresh, !isFinal)

  // RF08: avisos cuando el turno se acerca y cuando es llamado (una sola vez cada uno).
  useEffect(() => {
    if (!snap?.found) return
    const kind = getAlert(snap, alerted.current)
    if (!kind) return
    alerted.current[kind] = true
    setBanner(kind)
    vibrate()
    beep(kind === 'called' ? 3 : 2)
    void showSystemNotification(
      kind === 'called' ? '¡Es tu turno!' : 'Tu turno se acerca',
      kind === 'called'
        ? `Turno ${snap.number}: acércate a ${snap.business_name}.`
        : `Turno ${snap.number}: ya casi te toca en ${snap.business_name}.`,
      window.location.href
    )
  }, [snap])

  useEffect(() => {
    if (!snap?.found) return
    const base = `Turno ${snap.number} · TuTurno`
    document.title = snap.status === 'called' ? `¡Es tu turno! · ${base}` : base
  }, [snap])

  async function onEnableNotifications() {
    unlockAudio()
    setNotif(await enableNotifications())
  }

  async function onLeave() {
    if (!window.confirm('¿Seguro que quieres salir de la fila? Perderás tu turno.')) return
    setLeaving(true)
    await createClient().rpc('cancel_my_ticket', { p_token: token })
    await refresh()
    setLeaving(false)
  }

  if (!snap) {
    return (
      <main className="mx-auto max-w-md px-4 py-10" aria-live="polite">
        {loadError ? <p role="alert" className="alert-error">{loadError}</p> : <p className="text-center text-slate-600">Cargando tu turno…</p>}
      </main>
    )
  }

  if (!snap.found) {
    return (
      <Shell>
        <h1 className="text-xl font-bold">Turno no encontrado</h1>
        <p className="mt-2 text-slate-600">Este enlace no corresponde a ningún turno. Escanea de nuevo el código QR del negocio.</p>
      </Shell>
    )
  }

  const backLink = (
    <Link href={`/n/${snap.business_slug}`} className="btn btn-primary mt-5 w-full">Tomar un nuevo turno</Link>
  )

  if (snap.expired) {
    return (
      <Shell business={snap.business_name}>
        <h1 className="text-xl font-bold">Este turno era de otro día</h1>
        <p className="mt-2 text-slate-600">Los turnos se reinician cada día. Toma uno nuevo escaneando el QR.</p>
        {backLink}
      </Shell>
    )
  }

  const called = snap.status === 'called'
  const waiting = snap.status === 'waiting'
  const ahead = snap.people_ahead ?? 0

  return (
    <Shell business={snap.business_name}>
      <p className="text-sm font-medium text-slate-600">Hola, {snap.customer_name}</p>
      <p className="mt-3 text-sm uppercase tracking-wide text-slate-600">Tu turno</p>
      <p className="text-8xl font-extrabold leading-none text-indigo-700" aria-label={`Tu turno es el ${snap.number}`}>
        {snap.number}
      </p>

      <div aria-live="polite" className="mt-6">
        {called && (
          <p className="animate-pulse rounded-xl bg-emerald-700 px-4 py-4 text-xl font-bold text-white">
            ¡Es tu turno! Acércate a {snap.business_name}.
          </p>
        )}

        {waiting && (
          <>
            <p className="text-2xl font-bold">
              {ahead === 0 ? 'Eres el siguiente' : ahead === 1 ? 'Falta 1 persona antes de ti' : `Faltan ${ahead} personas antes de ti`}
            </p>
            {banner === 'near' && (
              <p className="mt-3 rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-300">
                ¡Tu turno se acerca! Ve regresando al local.
              </p>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-3 text-left text-sm">
              <div className="rounded-lg bg-slate-100 p-3">
                <dt className="text-slate-600">En atención ahora</dt>
                <dd className="text-2xl font-bold">{snap.now_serving ?? '—'}</dd>
              </div>
              <div className="rounded-lg bg-slate-100 p-3">
                <dt className="text-slate-600">Espera aproximada</dt>
                <dd className="text-2xl font-bold">
                  {ahead === 0 ? 'Ya casi' : snap.estimated_wait_seconds != null ? formatDuration(snap.estimated_wait_seconds) : '—'}
                </dd>
              </div>
            </dl>
          </>
        )}

        {snap.status === 'attended' && (
          <>
            <p className="text-xl font-bold">Atención finalizada. ¡Gracias por tu visita!</p>
            {backLink}
          </>
        )}
        {snap.status === 'absent' && (
          <>
            <p className="text-xl font-bold">Tu turno fue marcado como ausente</p>
            <p className="mt-2 text-slate-600">Si aún quieres ser atendido, toma un nuevo turno.</p>
            {backLink}
          </>
        )}
        {snap.status === 'cancelled' && (
          <>
            <p className="text-xl font-bold">Saliste de la fila</p>
            {backLink}
          </>
        )}
      </div>

      {!isFinal && (
        <div className="mt-6 space-y-3 border-t border-slate-200 pt-5">
          {notif === 'default' && (
            <button type="button" onClick={onEnableNotifications} className="btn btn-secondary w-full">
              🔔 Activar avisos (sonido y notificación)
            </button>
          )}
          {notif === 'granted' && <p className="text-sm text-emerald-800">🔔 Avisos activados. Mantén esta pestaña abierta.</p>}
          {notif === 'denied' && <p className="text-sm text-slate-600">Bloqueaste las notificaciones; igual verás el aviso en esta pantalla.</p>}
          {notif === 'unsupported' && (
            <button type="button" onClick={unlockAudio} className="btn btn-secondary w-full">🔊 Activar sonido de aviso</button>
          )}
          <p className="text-xs text-slate-600">
            Te avisaremos cuando falten {NEAR_THRESHOLD} personas o menos. Esta pantalla se actualiza sola
            {connected ? ' (en tiempo real).' : '.'}
          </p>
          {waiting && (
            <button type="button" onClick={onLeave} disabled={leaving} className="btn btn-danger w-full">
              {leaving ? 'Saliendo…' : 'Salir de la fila'}
            </button>
          )}
          {loadError && <p role="alert" className="alert-error">{loadError}</p>}
        </div>
      )}
    </Shell>
  )
}

function Shell({ business, children }: { business?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <div className="card text-center">
        {business && <p className="mb-4 text-lg font-bold text-slate-800">{business}</p>}
        {children}
      </div>
      <p className="mt-4 text-center text-xs text-slate-600">
        <Link href="/privacidad" className="underline">Aviso de privacidad</Link> · TuTurno
      </p>
    </main>
  )
}
