import { describe, expect, it } from 'vitest'
import { isSlug, isUuid, joinSchema, loginSchema, manualTicketSchema, registerSchema } from '@/lib/validation'

describe('joinSchema (RF03)', () => {
  it('acepta nombre + consentimiento; el celular es opcional', () => {
    const r = joinSchema.safeParse({ name: '  Laura ', phone: '', consent: true })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.name).toBe('Laura')
      expect(r.data.phone).toBeUndefined()
    }
  })
  it('acepta un celular colombiano con formato', () => {
    expect(joinSchema.safeParse({ name: 'Laura', phone: '300 123 4567', consent: true }).success).toBe(true)
    expect(joinSchema.safeParse({ name: 'Laura', phone: '+57 (300) 123-4567', consent: true }).success).toBe(true)
  })
  it('rechaza nombre vacío o demasiado largo', () => {
    expect(joinSchema.safeParse({ name: '   ', consent: true }).success).toBe(false)
    expect(joinSchema.safeParse({ name: 'a'.repeat(61), consent: true }).success).toBe(false)
  })
  it('rechaza celulares con letras o muy cortos', () => {
    expect(joinSchema.safeParse({ name: 'Ana', phone: 'abc', consent: true }).success).toBe(false)
    expect(joinSchema.safeParse({ name: 'Ana', phone: '123', consent: true }).success).toBe(false)
  })
  it('exige el consentimiento (Ley 1581)', () => {
    expect(joinSchema.safeParse({ name: 'Ana', consent: false }).success).toBe(false)
  })
})

describe('otros esquemas', () => {
  it('manualTicketSchema no exige consentimiento', () => {
    expect(manualTicketSchema.safeParse({ name: 'Cliente' }).success).toBe(true)
  })
  it('registerSchema valida correo, contraseña y negocio', () => {
    expect(registerSchema.safeParse({ businessName: 'Ana', email: 'a@b.co', password: '12345678' }).success).toBe(true)
    expect(registerSchema.safeParse({ businessName: 'Ana', email: 'no-es-correo', password: '12345678' }).success).toBe(false)
    expect(registerSchema.safeParse({ businessName: 'Ana', email: 'a@b.co', password: '1234567' }).success).toBe(false)
    expect(registerSchema.safeParse({ businessName: 'A', email: 'a@b.co', password: '12345678' }).success).toBe(false)
  })
  it('loginSchema', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true)
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false)
  })
})

describe('isUuid / isSlug', () => {
  it('valida tokens y slugs de la URL', () => {
    expect(isUuid('3f2b8c1e-9a4d-4e6b-8c1f-0a1b2c3d4e5f')).toBe(true)
    expect(isUuid("1'; drop table tickets;--")).toBe(false)
    expect(isSlug('peluqueria-ana-x1y2')).toBe(true)
    expect(isSlug('Peluqueria Ana')).toBe(false)
    expect(isSlug('../etc/passwd')).toBe(false)
    expect(isSlug('ab')).toBe(false)
  })
})
