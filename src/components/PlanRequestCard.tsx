'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/errors'
import { formatCOP, PLANS } from '@/lib/plans'
import type { MyPlanRequest, PlanId } from '@/lib/types'

interface Props {
  currentPlan: PlanId
  initialRequest: MyPlanRequest | null
}

/** El dueño solicita pasar a Pro (o volver a gratis). El super admin la acepta o la niega. */
export default function PlanRequestCard({ currentPlan, initialRequest }: Props) {
  const [request, setRequest] = useState<MyPlanRequest | null>(initialRequest)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const target: PlanId = currentPlan === 'free' ? 'pro' : 'free'
  const pending = request?.status === 'pending' ? request : null
  // Solo mostramos el resultado de la última solicitud si aún es relevante para el plan actual.
  const lastResolved = request && request.status !== 'pending' ? request : null

  async function reload() {
    const { data } = await createClient().rpc('get_my_plan_request')
    setRequest((data as MyPlanRequest | null) ?? null)
  }

  async function onRequest() {
    const text = target === 'pro'
      ? `¿Solicitar el cambio al plan Pro (${formatCOP(PLANS.pro.price)} COP al mes)? Te contactaremos para coordinar el pago.`
      : '¿Solicitar volver al plan Gratuito? Tendrás un límite de 30 turnos por día.'
    if (!window.confirm(text)) return
    setBusy(true)
    setError(null)
    const { error } = await createClient().rpc('request_plan_change', { p_plan: target })
    if (error) setError(friendlyError(error.message))
    await reload()
    setBusy(false)
  }

  async function onCancel() {
    if (!window.confirm('¿Retirar tu solicitud de cambio de plan?')) return
    setBusy(true)
    setError(null)
    const { error } = await createClient().rpc('cancel_plan_request')
    if (error) setError(friendlyError(error.message))
    await reload()
    setBusy(false)
  }

  const plan = PLANS[currentPlan]
  const other = PLANS[target]

  return (
    <section className="card" aria-label="Tu plan">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Tu plan</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${currentPlan === 'free' ? 'bg-slate-200 text-slate-800' : 'bg-indigo-100 text-indigo-800'}`}>
          {plan.name} · {formatCOP(plan.price)}{plan.price > 0 ? ' / mes' : ''}
        </span>
      </div>

      {pending ? (
        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-900 ring-1 ring-amber-200" role="status">
          <p className="font-semibold">
            Solicitud enviada: cambiar a plan {PLANS[pending.requested_plan].name}
          </p>
          <p className="mt-1">
            Está pendiente de aprobación por el administrador de TuTurno
            {pending.requested_plan === 'pro' ? '. Te contactaremos para coordinar el pago por transferencia.' : '.'}
          </p>
          <button type="button" className="btn btn-secondary mt-3 w-full" disabled={busy} onClick={onCancel}>
            Retirar solicitud
          </button>
        </div>
      ) : (
        <>
          {lastResolved?.status === 'approved' && lastResolved.requested_plan === currentPlan && (
            <p className="alert-ok mt-3">Tu solicitud fue aprobada: ya estás en el plan {plan.name}.</p>
          )}
          {lastResolved?.status === 'rejected' && (
            <p className="alert-error mt-3">
              Tu última solicitud para pasar al plan {PLANS[lastResolved.requested_plan].name} fue rechazada. Puedes volver a solicitarlo.
            </p>
          )}
          <p className="mt-3 text-sm text-slate-700">
            {target === 'pro'
              ? `Con el plan Pro tienes turnos ilimitados por ${formatCOP(other.price)} COP al mes.`
              : 'Si ya no necesitas turnos ilimitados, puedes volver al plan Gratuito (hasta 30 turnos por día).'}
          </p>
          <button type="button" className={`btn mt-3 w-full ${target === 'pro' ? 'btn-primary' : 'btn-secondary'}`}
            disabled={busy} onClick={onRequest}>
            {target === 'pro' ? 'Solicitar cambio a plan Pro' : 'Solicitar cambio a plan Gratuito'}
          </button>
        </>
      )}
      {error && <p role="alert" className="alert-error mt-3">{error}</p>}
    </section>
  )
}
