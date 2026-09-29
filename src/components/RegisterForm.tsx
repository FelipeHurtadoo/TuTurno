'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/errors'
import { registerSchema } from '@/lib/validation'

export default function RegisterForm() {
  const router = useRouter()
  const [businessName, setBusinessName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendingEmail, setPendingEmail] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = registerSchema.safeParse({ businessName, email, password })
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setLoading(true)
    const { data, error } = await createClient().auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { business_name: parsed.data.businessName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setLoading(false)
    if (error) {
      setError(friendlyError(error.message))
      return
    }
    // Con "Confirm email" desactivado en Supabase, signUp ya devuelve sesión.
    if (data.session) {
      router.push('/panel')
      router.refresh()
    } else {
      setPendingEmail(true)
    }
  }

  if (pendingEmail) {
    return (
      <div className="space-y-3" aria-live="polite">
        <p className="alert-ok">
          Te enviamos un correo de confirmación. Ábrelo, confirma tu cuenta y luego inicia sesión para crear tu negocio.
        </p>
        <Link href="/login" className="btn btn-primary w-full">Ir a iniciar sesión</Link>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="businessName" className="label">Nombre de tu negocio</label>
        <input id="businessName" className="input" value={businessName} maxLength={80}
          placeholder="Ej. Peluquería Ana" onChange={(e) => setBusinessName(e.target.value)} required />
      </div>
      <div>
        <label htmlFor="email" className="label">Correo electrónico</label>
        <input id="email" type="email" autoComplete="email" className="input" value={email}
          onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label htmlFor="password" className="label">Contraseña (mínimo 8 caracteres)</label>
        <input id="password" type="password" autoComplete="new-password" className="input" value={password}
          onChange={(e) => setPassword(e.target.value)} required minLength={8} />
      </div>
      {error && <p role="alert" className="alert-error">{error}</p>}
      <button type="submit" className="btn btn-primary w-full" disabled={loading}>
        {loading ? 'Creando cuenta…' : 'Crear cuenta gratis'}
      </button>
      <p className="text-center text-sm text-slate-600">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="font-semibold text-indigo-700 underline">Inicia sesión</Link>
      </p>
    </form>
  )
}
