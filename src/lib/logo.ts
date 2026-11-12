export const LOGO_BUCKET = 'logos'
export const LOGO_MAX_BYTES = 2 * 1024 * 1024
export const LOGO_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

/** URL pública del logo guardado en Supabase Storage (bucket público "logos"). */
export function logoUrl(path?: string | null): string | null {
  if (!path) return null
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  const clean = path.split('/').map(encodeURIComponent).join('/')
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/${LOGO_BUCKET}/${clean}`
}

/** Valida el archivo antes de subirlo. Devuelve un mensaje de error o null. */
export function validateLogoFile(file: { type: string; size: number }): string | null {
  if (!LOGO_TYPES[file.type]) return 'El logo debe ser una imagen PNG, JPG o WEBP.'
  if (file.size > LOGO_MAX_BYTES) return 'El logo no puede pesar más de 2 MB.'
  return null
}
