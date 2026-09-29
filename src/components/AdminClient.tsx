'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import Logo from './Logo'
import { createClient } from '@/lib/supabase/client'
import { friendlyError, isAuthError } from '@/lib/errors'
import type { SuperAdminBusiness } from '@/lib/types'

interface Props {
  initial: SuperAdminBusiness[]
}

export default function AdminClient({ initial }: Props) {
  const router = useRouter()
  const [businesses, setBusinesses] = useState<SuperAdminBusiness[]>(initial)
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
    const { data, error } = await createClient().rpc('admin_list_businesses')
    if (error) return handleError(error.message)
    setBusinesses((data ?? []) as SuperAdminBusiness[])
  }, [handleError])

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
                    <td className="py-2 pr-3 font-medium">{b.name}</td>
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
