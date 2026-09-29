import type { TicketStatusResult } from './types'

/** RF08: se avisa cuando faltan este número de personas (o menos) antes del cliente. */
export const NEAR_THRESHOLD = 2

export type AlertKind = 'near' | 'called'
export interface AlertState {
  near: boolean
  called: boolean
}

/**
 * Decide si hay que avisar al cliente. Función pura (fácil de probar).
 * Cada aviso se dispara una sola vez: quien llama debe marcar `done[kind] = true`.
 */
export function getAlert(
  s: Pick<TicketStatusResult, 'status' | 'people_ahead' | 'expired'>,
  done: AlertState
): AlertKind | null {
  if (s.expired) return null
  if (s.status === 'called' && !done.called) return 'called'
  if (
    s.status === 'waiting' &&
    typeof s.people_ahead === 'number' &&
    s.people_ahead <= NEAR_THRESHOLD &&
    !done.near
  ) {
    return 'near'
  }
  return null
}
