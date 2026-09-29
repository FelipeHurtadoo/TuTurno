// Utilidades de navegador. Todo va en try/catch: en modo privado localStorage puede fallar.
const DEVICE_KEY = 'tuturno:device'
const ticketKey = (slug: string) => `tuturno:ticket:${slug}`

/**
 * UUID v4 con getRandomValues. NO usamos crypto.randomUUID() porque solo existe en
 * contextos seguros (HTTPS/localhost) y fallaría al probar desde el celular por http://IP-LAN.
 */
export function uuidv4(): string {
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function getDeviceId(): string | null {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = uuidv4()
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

export function saveTicketToken(slug: string, token: string) {
  try {
    localStorage.setItem(ticketKey(slug), token)
  } catch {}
}

export function getTicketToken(slug: string): string | null {
  try {
    return localStorage.getItem(ticketKey(slug))
  } catch {
    return null
  }
}

export function clearTicketToken(slug: string) {
  try {
    localStorage.removeItem(ticketKey(slug))
  } catch {}
}
