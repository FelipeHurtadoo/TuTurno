import { z } from 'zod'

// Mismas reglas que las restricciones de la base de datos (schema.sql).
export const PHONE_REGEX = /^[0-9+ ()-]{7,20}$/

const nameField = z
  .string()
  .trim()
  .min(1, 'Escribe tu nombre.')
  .max(60, 'El nombre es muy largo (máximo 60 caracteres).')

const phoneField = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine(
    (v) => v === undefined || PHONE_REGEX.test(v),
    'El celular solo puede llevar números, espacios, + ( ) - (entre 7 y 20 caracteres).'
  )

export const joinSchema = z.object({
  name: nameField,
  phone: phoneField,
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Debes aceptar el tratamiento de datos para tomar un turno.' }),
  }),
})

export const manualTicketSchema = z.object({ name: nameField, phone: phoneField })

export const registerSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(2, 'El nombre del negocio debe tener al menos 2 caracteres.')
    .max(80, 'El nombre del negocio es muy largo (máximo 80).'),
  email: z.string().trim().email('Escribe un correo válido.'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres.')
    .max(72, 'La contraseña es muy larga (máximo 72 caracteres).'),
})

export const loginSchema = z.object({
  email: z.string().trim().email('Escribe un correo válido.'),
  password: z.string().min(1, 'Escribe tu contraseña.'),
})

export const businessNameSchema = registerSchema.shape.businessName

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v: string) => UUID_REGEX.test(v)
export const isSlug = (v: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v) && v.length >= 3 && v.length <= 60
