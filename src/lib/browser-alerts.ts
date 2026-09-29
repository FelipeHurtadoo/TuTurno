// Avisos en el navegador del cliente (RF08): notificación del sistema, vibración, sonido.
// Todo es "mejor esfuerzo": depende del navegador y de que la pestaña siga abierta.

export type NotifState = 'unsupported' | 'default' | 'granted' | 'denied'

export function getNotifState(): NotifState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission as NotifState
}

let audioCtx: AudioContext | null = null

/** Debe llamarse dentro de un clic del usuario para que el navegador permita el sonido. */
export function unlockAudio() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    if (!audioCtx) audioCtx = new Ctx()
    void audioCtx.resume()
  } catch {}
}

export function beep(times = 2) {
  if (!audioCtx) return
  const ctx = audioCtx
  for (let i = 0; i < times; i++) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const start = ctx.currentTime + i * 0.35
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.4, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + 0.3)
  }
}

export function vibrate(pattern: number[] = [250, 120, 250, 120, 500]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {}
}

/** Pide permiso de notificaciones y registra el service worker (necesario en Android). */
export async function enableNotifications(): Promise<NotifState> {
  unlockAudio()
  if (getNotifState() === 'unsupported') return 'unsupported'
  try {
    if ('serviceWorker' in navigator) await navigator.serviceWorker.register('/sw.js')
  } catch {}
  try {
    return (await Notification.requestPermission()) as NotifState
  } catch {
    return getNotifState()
  }
}

export async function showSystemNotification(title: string, body: string, url: string) {
  if (getNotifState() !== 'granted') return
  try {
    // Android/Chrome solo permite notificaciones vía service worker.
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    if (reg) {
      await reg.showNotification(title, {
        body,
        tag: 'tuturno',
        data: { url },
        vibrate: [250, 120, 250],
      } as NotificationOptions)
      return
    }
  } catch {}
  try {
    new Notification(title, { body, tag: 'tuturno' })
  } catch {}
}
