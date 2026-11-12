'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import BusinessLogo from './BusinessLogo'
import Logo from './Logo'
import { createClient } from '@/lib/supabase/client'
import { friendlyError, isAuthError } from '@/lib/errors'
import { formatCOP, PLANS } from '@/lib/plans'
import type { SuperAdminBusiness, SuperAdminPlanRequest } from '@/lib/types'

interface Props {
  initial: SuperAdminBusiness[]
  initialRequests?: SuperAdminPlanRequest[]
}

export default function AdminClient({ initial, initialRequests = [] }: Props) {
  const router = useRouter()
  const [businesses, setBusinesses] = useState<SuperAdminBusiness[]>(initial)
  const [requests, setRequests] = useState<SuperAdminPlanRequest[]>(initialRequests)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null)

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
    const supabase = createClient()
    const [list, pending] = await Promise.all([
      supabase.rpc('admin_list_businesses'),
      supabase.rpc('admin_list_plan_requests'),
    ])
    if (list.error) return handleError(list.error.message)
    setBusinesses((list.data ?? []) as SuperAdminBusiness[])
    if (!pending.error) setRequests((pending.data ?? []) as SuperAdminPlanRequest[])
  }, [handleError])

  async function resolveRequest(r: SuperAdminPlanRequest, approve: boolean) {
    const planName = PLANS[r.requested_plan].name
    const question = approve
      ? `¿Aprobar el cambio de ${r.business_name} al plan ${planName}?${r.requested_plan === 'pro' ? ' Confirma que ya recibiste el pago.' : ''}`
      : `¿Rechazar la solicitud de ${r.business_name} para pasar al plan ${planName}?`
    if (!window.confirm(question)) return
    setBusyId(r.id)
    setMessage(null)
    const { error } = await createClient().rpc('admin_resolve_plan_request', { p_request_id: r.id, p_approve: approve })
    if (error) handleError(error.message)
    else setMessage({
      kind: 'ok',
      text: approve ? `${r.business_name} ahora está en plan ${planName}.` : `Solicitud de ${r.business_name} rechazada.`,
    })
    await refresh()
    setBusyId(null)
  }

  async function togglePlan(b: SuperAdminBusiness) {
    const nextPlan = b.plan === 'free' ? 'pro' : 'free'
    setBusyId(b.id)
    setMessage(null)
    const { error } = await createClient().rpc('admin_set_plan', { p_business_id: b.id, p_plan: nextPlan })
    if (error) handleError(error.message)
    else setMessage({ kind: 'ok', text: `${b.name} ahora está en plan ${nextPlan === 'pro' ? 'Pro' : 'gratuito'}.` })
    await refresh()
    setBusyId(null)
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-4">
            <Logo href="/admin" />
            <span className="hidden text-slate-400 sm:inline">|</span>
            <span className="font-semibold">Super admin</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {message && (
          <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? 'alert-error' : 'alert-ok'}>
            {message.text}
          </p>
        )}

        <section className="card" aria-label="Solicitudes de cambio de plan">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Solicitudes de cambio de plan ({requests.length})</h2>
            <button type="button" className="btn btn-secondary !min-h-[36px] !px-3" onClick={() => void refresh()}>Actualizar</button>
          </div>
          {requests.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">No hay solicitudes pendientes.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-200">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {r.business_name} <span className="text-sm font-normal text-slate-600">/{r.business_slug}</span>
                    </p>
                    <p className="text-sm">
                      {PLANS[r.current_plan].name} → <strong className={r.requested_plan === 'pro' ? 'text-indigo-800' : ''}>
                        {PLANS[r.requested_plan].name}
                      </strong>
                      {r.requested_plan === 'pro' && <span className="text-slate-600"> · {formatCOP(PLANS.pro.price)} COP/mes</span>}
                    </p>
                    <p className="text-xs text-slate-600">
                      {r.owner_email ? <a href={`mailto:${r.owner_email}`} className="underline">{r.owner_email}</a> : 'Sin correo'}
                      {' · '}{new Date(r.created_at).toLocaleString('es-CO')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="btn btn-success !min-h-[36px] !px-3" disabled={busyId === r.id}
                      onClick={() => resolveRequest(r, true)}>
                      Aceptar
                    </button>
                    <button type="button" className="btn btn-danger !min-h-[36px] !px-3" disabled={busyId === r.id}
                      onClick={() => resolveRequest(r, false)}>
                      Rechazar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-x-auto" aria-label="Negocios registrados">
          <h2 className="font-semibold">Negocios registrados ({businesses.length})</h2>
          {businesses.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">Todavía no hay negocios registrados.</p>
          ) : (
            <table className="mt-3 w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-600">
                  <th className="py-2 pr-3">Negocio</th>
                  <th className="py-2 pr-3">Enlace</th>
                  <th className="py-2 pr-3">Plan</th>
                  <th className="py-2 pr-3">Turnos hoy</th>
                  <th className="py-2 pr-3">Registrado</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {businesses.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2 pr-3 font-medium">
                      <span className="flex items-center gap-2">
                        <BusinessLogo path={b.logo_path} name={b.name} className="h-7 w-7" />
                        {b.name}
                        {requests.some((r) => r.business_id === b.id) && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Solicitud pendiente</span>
                        )}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-600">/{b.slug}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${b.plan === 'free' ? 'bg-slate-200 text-slate-800' : 'bg-indigo-100 text-indigo-800'}`}>
                        {b.plan === 'free' ? 'Gratuito' : 'Pro'}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{b.plan === 'free' ? `${b.issued_today} / ${b.daily_limit}` : b.issued_today}</td>
                    <td className="py-2 pr-3 text-slate-600">{new Date(b.created_at).toLocaleDateString('es-CO')}</td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        className="btn btn-secondary !min-h-[36px] !px-3"
                        disabled={busyId === b.id}
                        onClick={() => togglePlan(b)}
                      >
                        {b.plan === 'free' ? 'Cambiar a Premium' : 'Volver a gratis'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  )
}
