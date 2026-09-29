'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import AuthShell from './AuthShell'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/errors'
import { makeSlug } from '@/lib/slug'
import { businessNameSchema } from '@/lib/validation'

/** Se muestra si el usuario ya tiene cuenta pero aún no ha creado su negocio (p. ej. tras confirmar el correo). */
export default function CreateBusinessForm({ defaultName }: { defaultName: string }) {
  const router = useRouter()
  const [name, setName] = useState(defaultName)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = businessNameSchema.safeParse(name)
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setLoading(true)
    const supabase = createClient()
    let lastError = ''
    // Si el enlace generado ya existe (muy improbable), reintenta con otro sufijo.
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await supabase.rpc('register_business', { p_name: parsed.data, p_slug: makeSlug(parsed.data) })
      if (!error) {
        router.refresh()
        return
      }
      lastError = error.message
      if (!error.message.includes('SLUG_EN_USO')) break
    }
    setError(friendlyError(lastError))
    setLoading(false)
  }

  return (
    <AuthShell title="Crea tu negocio" subtitle="Último paso: dile a TuTurno cómo se llama tu negocio.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="name" className="label">Nombre de tu negocio</label>
          <input id="name" className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} required />
        </div>
        {error && <p role="alert" className="alert-error">{error}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? 'Creando…' : 'Crear negocio'}
        </button>
      </form>
    </AuthShell>
  )
}
