'use client'

import { useRef, useState } from 'react'
import BusinessLogo from './BusinessLogo'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/errors'
import { LOGO_BUCKET, LOGO_TYPES, validateLogoFile } from '@/lib/logo'

interface Props {
  businessId: string
  businessName: string
  initialPath: string | null
  onChange?: (path: string | null) => void
}

/** Sube el logo del negocio a Supabase Storage (carpeta '<business_id>/') y guarda la ruta. */
export default function LogoUploader({ businessId, businessName, initialPath, onChange }: Props) {
  const [path, setPath] = useState<string | null>(initialPath)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null)
  const input = useRef<HTMLInputElement>(null)

  async function save(newPath: string | null) {
    const supabase = createClient()
    const { error } = await supabase.rpc('set_business_logo', { p_path: newPath })
    if (error) throw new Error(error.message)
    // Borra el archivo anterior para no acumular imágenes viejas (si falla, no es grave).
    if (path && path !== newPath) await supabase.storage.from(LOGO_BUCKET).remove([path])
    setPath(newPath)
    onChange?.(newPath)
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setMessage(null)
    const invalid = validateLogoFile(file)
    if (invalid) return setMessage({ kind: 'error', text: invalid })

    setBusy(true)
    try {
      const newPath = `${businessId}/logo-${Date.now()}.${LOGO_TYPES[file.type]}`
      const { error } = await createClient().storage.from(LOGO_BUCKET).upload(newPath, file, {
        contentType: file.type,
        cacheControl: '31536000',
        upsert: false,
      })
      if (error) throw new Error(error.message)
      await save(newPath)
      setMessage({ kind: 'ok', text: 'Logo actualizado. Ya aparece en tu pantalla pública y en el QR.' })
    } catch (err) {
      setMessage({ kind: 'error', text: uploadError(err) })
    } finally {
      setBusy(false)
    }
  }

  async function onRemove() {
    if (!window.confirm('¿Quitar el logo de tu negocio?')) return
    setBusy(true)
    setMessage(null)
    try {
      await save(null)
      setMessage({ kind: 'ok', text: 'Logo eliminado.' })
    } catch (err) {
      setMessage({ kind: 'error', text: uploadError(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card" aria-label="Logo del negocio">
      <h2 className="font-semibold">Logo del negocio</h2>
      <p className="text-sm text-slate-600">Aparece en la pantalla pública, en el afiche del QR y en el celular de tus clientes.</p>
      <div className="mt-3 flex items-center gap-4">
        {path ? (
          <BusinessLogo path={path} name={businessName} className="h-20 w-20 ring-1 ring-slate-200" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-500 ring-1 ring-slate-200">
            Sin logo
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2">
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" id="logo-file"
            onChange={onFile} disabled={busy} />
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? 'Guardando…' : path ? 'Cambiar logo' : 'Subir logo'}
          </button>
          {path && (
            <button type="button" className="btn btn-danger !min-h-[36px]" disabled={busy} onClick={onRemove}>Quitar logo</button>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-600">PNG, JPG o WEBP · máximo 2 MB · ideal cuadrado.</p>
      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={`mt-3 ${message.kind === 'error' ? 'alert-error' : 'alert-ok'}`}>
          {message.text}
        </p>
      )}
    </section>
  )
}

function uploadError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/bucket not found/i.test(msg)) return 'El almacenamiento de logos aún no está configurado. Avísale al administrador.'
  if (/row-level security|unauthorized|403/i.test(msg)) return 'No tienes permiso para subir este logo. Recarga la página e inténtalo de nuevo.'
  if (/exceeded|too large|payload/i.test(msg)) return 'El logo no puede pesar más de 2 MB.'
  if (/mime type/i.test(msg)) return 'El logo debe ser una imagen PNG, JPG o WEBP.'
  return friendlyError(msg)
}
