import { describe, expect, it } from 'vitest'
import { friendlyError, isAuthError } from '@/lib/errors'
import { formatDuration } from '@/lib/format'

describe('friendlyError', () => {
  it('traduce los códigos de la base de datos', () => {
    expect(friendlyError('LIMITE_DIARIO')).toMatch(/límite de turnos/)
    expect(friendlyError('TURNO_EN_CURSO')).toMatch(/atendido o ausente/)
    expect(friendlyError('SIN_PERMISO')).toMatch(/permiso/)
  })
  it('traduce errores de autenticación y de red', () => {
    expect(friendlyError('Invalid login credentials')).toBe('Correo o contraseña incorrectos.')
    expect(friendlyError('TypeError: Failed to fetch')).toMatch(/conexión/)
  })
  it('nunca filtra mensajes internos', () => {
    expect(friendlyError('relation "public.tickets" does not exist')).toBe('Ocurrió un error inesperado. Inténtalo de nuevo.')
    expect(friendlyError(undefined)).toMatch(/inesperado/)
  })
  it('detecta sesión expirada', () => {
    expect(isAuthError('NO_AUTENTICADO')).toBe(true)
    expect(isAuthError('SIN_PERMISO')).toBe(false)
  })
})

describe('formatDuration', () => {
  it('formatea segundos, minutos y horas', () => {
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(20)).toBe('menos de 1 min')
    expect(formatDuration(600)).toBe('10 min')
    expect(formatDuration(3600)).toBe('1 h')
    expect(formatDuration(5400)).toBe('1 h 30 min')
  })
})
