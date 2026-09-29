import { describe, expect, it } from 'vitest'
import { getAlert, NEAR_THRESHOLD } from '@/lib/notify'
import { uuidv4 } from '@/lib/device'
import { isUuid } from '@/lib/validation'

describe('getAlert (RF08)', () => {
  const fresh = () => ({ near: false, called: false })

  it('avisa "cerca" cuando faltan NEAR_THRESHOLD personas o menos', () => {
    expect(getAlert({ status: 'waiting', people_ahead: NEAR_THRESHOLD + 1 }, fresh())).toBeNull()
    expect(getAlert({ status: 'waiting', people_ahead: NEAR_THRESHOLD }, fresh())).toBe('near')
    expect(getAlert({ status: 'waiting', people_ahead: 0 }, fresh())).toBe('near')
  })
  it('avisa "llamado" cuando el turno pasa a called', () => {
    expect(getAlert({ status: 'called', people_ahead: 0 }, fresh())).toBe('called')
  })
  it('cada aviso se dispara una sola vez', () => {
    expect(getAlert({ status: 'waiting', people_ahead: 1 }, { near: true, called: false })).toBeNull()
    expect(getAlert({ status: 'called' }, { near: true, called: true })).toBeNull()
  })
  it('no avisa turnos vencidos ni ya finalizados', () => {
    expect(getAlert({ status: 'waiting', people_ahead: 0, expired: true }, fresh())).toBeNull()
    expect(getAlert({ status: 'attended' }, fresh())).toBeNull()
    expect(getAlert({ status: 'absent' }, fresh())).toBeNull()
  })
})

describe('uuidv4', () => {
  it('genera UUID v4 válidos y distintos (sin depender de crypto.randomUUID)', () => {
    const ids = Array.from({ length: 200 }, () => uuidv4())
    ids.forEach((id) => {
      expect(isUuid(id)).toBe(true)
      expect(id[14]).toBe('4')
      expect('89ab').toContain(id[19])
    })
    expect(new Set(ids).size).toBe(200)
  })
})
