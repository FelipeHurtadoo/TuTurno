'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/errors'
import { clearTicketToken, getDeviceId, getTicketToken, saveTicketToken } from '@/lib/device'
import { joinSchema } from '@/lib/validation'
import type { JoinResult, TicketStatusResult } from '@/lib/types'

interface Props {
  slug: string
  businessName: string
  accepting: boolean
}

export default function JoinForm({ slug, businessName, accepting }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  // Si este celular ya tiene un turno activo en este negocio, lo llevamos directo a él.
  useEffect(() => {
    const token = getTicketToken(slug)
    if (!token) {
      setChecking(false)
      return
    }
    let cancelled = false
    createClient()
      .rpc('get_ticket_status', { p_token: token })
      .then(({ data, error }) => {
        if (cancelled) return
        const s = data as TicketStatusResult | null
        const active = !error && s?.found && !s.expired && (s.status === 'waiting' || s.status === 'called')
        if (active) {
          router.replace(`/t/${token}`)
        } else {
          if (!error) clearTicketToken(slug)
          setChecking(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [slug, router])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = joinSchema.safeParse({ name, phone, consent })
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setLoading(true)
    const { data, error } = await createClient().rpc('join_queue', {
      p_slug: slug,
      p_name: parsed.data.name,
      p_phone: parsed.data.phone ?? null,
      p_device: getDeviceId(),
      p_consent: parsed.data.consent,
    })
    if (error) {
      setError(friendlyError(error.message))
      setLoading(false)
      return
    }
    const result = data as JoinResult
    saveTicketToken(slug, result.token)
    router.push(`/t/${result.token}`)
  }

  if (checking) {
    return <p className="text-center text-sm text-slate-600" aria-live="polite">Buscando tu turno…</p>
  }

  if (!accepting) {
    return (
      <p role="alert" className="alert-error">
        {businessName} alcanzó su límite de turnos de hoy. Inténtalo más tarde o pregunta en el mostrador.
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="name" className="label">Tu nombre</label>
        <input id="name" className="input" value={name} maxLength={60} autoComplete="given-name"
          placeholder="Ej. Laura" onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label htmlFor="phone" className="label">Celular <span className="font-normal text-slate-600">(opcional)</span></label>
        <input id="phone" type="tel" inputMode="tel" className="input" value={phone} maxLength={20}
          autoComplete="tel" placeholder="300 123 4567" onChange={(e) => setPhone(e.target.value)}
          aria-describedby="phone-help" />
        <p id="phone-help" className="mt-1 text-xs text-slate-600">
          Solo si quieres que el negocio pueda contactarte. No es necesario para tomar turno.
        </p>
      </div>
      <div className="flex items-start gap-3">
        <input id="consent" type="checkbox" className="mt-1 h-5 w-5 rounded border-slate-400 accent-indigo-700"
          checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <label htmlFor="consent" className="text-sm text-slate-700">
          Autorizo el tratamiento de mis datos para gestionar mi turno, según el{' '}
          <Link href="/privacidad" target="_blank" className="font-semibold text-indigo-700 underline">
            aviso de privacidad
          </Link>.
        </label>
      </div>
      {error && <p role="alert" className="alert-error">{error}</p>}
      <button type="submit" className="btn btn-primary w-full text-base" disabled={loading}>
        {loading ? 'Tomando turno…' : 'Tomar mi turno'}
      </button>
    </form>
  )
}
