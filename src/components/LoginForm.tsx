'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/errors'
import { loginSchema } from '@/lib/validation'

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = loginSchema.safeParse({ email, password })
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setLoading(true)
    const { error } = await createClient().auth.signInWithPassword(parsed.data)
    if (error) {
      setError(friendlyError(error.message))
      setLoading(false)
      return
    }
    router.push('/panel')
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="label">Correo electrónico</label>
        <input id="email" type="email" autoComplete="email" className="input" value={email}
          onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label htmlFor="password" className="label">Contraseña</label>
        <input id="password" type="password" autoComplete="current-password" className="input" value={password}
          onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error && <p role="alert" className="alert-error">{error}</p>}
      <button type="submit" className="btn btn-primary w-full" disabled={loading}>
        {loading ? 'Entrando…' : 'Entrar'}
      </button>
      <p className="text-center text-sm text-slate-600">
        ¿Aún no tienes cuenta?{' '}
        <Link href="/registro" className="font-semibold text-indigo-700 underline">Registra tu negocio</Link>
      </p>
    </form>
  )
}
