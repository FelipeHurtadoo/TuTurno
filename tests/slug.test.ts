import { describe, expect, it } from 'vitest'
import { makeSlug, randomSuffix, slugify } from '@/lib/slug'

// Misma regla que la restricción de la tabla businesses en schema.sql
const DB_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

describe('slugify', () => {
  it('quita tildes, símbolos y espacios', () => {
    expect(slugify('Peluquería Ana & Co.')).toBe('peluqueria-ana-co')
    expect(slugify('  Niño   Ñandú  ')).toBe('nino-nandu')
  })
  it('usa un valor por defecto si no queda nada útil', () => {
    expect(slugify('!!!')).toBe('negocio')
    expect(slugify('')).toBe('negocio')
  })
  it('limita el largo sin dejar guion final', () => {
    const s = slugify('a'.repeat(39) + ' bbbbbbbb')
    expect(s.length).toBeLessThanOrEqual(40)
    expect(s.endsWith('-')).toBe(false)
  })
})

describe('makeSlug', () => {
  it('siempre cumple la restricción de la base de datos', () => {
    for (const name of ['Ana', 'Peluquería Ñandú & Hijos', '💈💈', 'x'.repeat(200), 'A B C']) {
      const slug = makeSlug(name)
      expect(slug).toMatch(DB_SLUG)
      expect(slug.length).toBeGreaterThanOrEqual(3)
      expect(slug.length).toBeLessThanOrEqual(60)
    }
  })
  it('agrega sufijos distintos', () => {
    const set = new Set(Array.from({ length: 50 }, () => randomSuffix(6)))
    expect(set.size).toBeGreaterThan(45)
  })
})
