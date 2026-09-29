/** "Peluquería Ana & Co." → "peluqueria-ana-co" (coincide con la restricción de la BD). */
export function slugify(input: string): string {
  const base = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
  return base || 'negocio'
}

export function randomSuffix(length = 4): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

/** Slug único probable: nombre + sufijo aleatorio (la BD igual garantiza unicidad). */
export function makeSlug(name: string): string {
  return `${slugify(name)}-${randomSuffix()}`
}
