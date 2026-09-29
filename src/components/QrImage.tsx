'use client'

import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

/** Genera el QR en el navegador (RF02). Devuelve la imagen como data URL para mostrarla o descargarla. */
export function useQrDataUrl(text: string | null, width = 512): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!text) return
    let cancelled = false
    QRCode.toDataURL(text, { width, margin: 2, errorCorrectionLevel: 'M' })
      .then((u) => !cancelled && setUrl(u))
      .catch(() => !cancelled && setUrl(null))
    return () => {
      cancelled = true
    }
  }, [text, width])
  return url
}

export function useOrigin(): string {
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])
  return origin
}
