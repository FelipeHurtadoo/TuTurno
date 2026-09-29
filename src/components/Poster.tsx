'use client'

import Link from 'next/link'
import { useOrigin, useQrDataUrl } from './QrImage'

/** RF02: QR único del negocio, descargable (PNG) e imprimible como afiche. */
export default function Poster({ businessName, slug }: { businessName: string; slug: string }) {
  const origin = useOrigin()
  const url = origin ? `${origin}/n/${slug}` : null
  const qr = useQrDataUrl(url, 1024)
  const isLocal = origin.includes('localhost') || /^https?:\/\/(\d{1,3}\.){3}\d{1,3}/.test(origin)

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2 px-4 py-4 print:hidden">
        <Link href="/panel" className="btn btn-secondary">← Volver al panel</Link>
        <div className="flex gap-2">
          {qr && (
            <a href={qr} download={`qr-${slug}.png`} className="btn btn-secondary">Descargar PNG</a>
          )}
          <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={!qr}>Imprimir afiche</button>
        </div>
      </div>

      {isLocal && (
        <p className="alert-ok mx-auto mb-4 max-w-2xl print:hidden">
          Estás en modo local: este QR apunta a <strong>{origin}</strong>, que solo funciona en este computador/red.
          Para un QR definitivo, despliega la app (Vercel) y descárgalo desde la dirección pública.
        </p>
      )}

      <article className="mx-auto max-w-2xl rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0">
        <p className="text-lg font-semibold text-indigo-700">{businessName}</p>
        <h1 className="mt-2 text-4xl font-extrabold leading-tight">Toma tu turno desde tu celular</h1>
        <p className="mt-2 text-lg text-slate-700">Sin filas, sin instalar nada.</p>

        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={`Código QR para tomar turno en ${businessName}`} className="mx-auto my-8 h-80 w-80" />
        ) : (
          <div className="mx-auto my-8 h-80 w-80 animate-pulse rounded bg-slate-200" />
        )}

        <ol className="mx-auto max-w-sm space-y-2 text-left text-lg">
          <li><strong>1.</strong> Abre la cámara de tu celular.</li>
          <li><strong>2.</strong> Apunta al código QR.</li>
          <li><strong>3.</strong> Escribe tu nombre y listo: verás tu turno.</li>
        </ol>
        <p className="mt-6 break-all text-xs text-slate-600">{url}</p>
      </article>
    </div>
  )
}
