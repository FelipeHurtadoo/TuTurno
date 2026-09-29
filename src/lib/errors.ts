// Los códigos vienen de las funciones SQL (raise exception 'CODIGO').
const DB_ERRORS: Record<string, string> = {
  LIMITE_DIARIO: 'Este negocio alcanzó su límite de turnos de hoy. Inténtalo más tarde o pregunta en el mostrador.',
  NEGOCIO_NO_ENCONTRADO: 'No encontramos ese negocio. Verifica el código QR.',
  NOMBRE_INVALIDO: 'El nombre no es válido (entre 1 y 60 caracteres).',
  CELULAR_INVALIDO: 'El celular no es válido.',
  CONSENTIMIENTO_REQUERIDO: 'Debes aceptar el tratamiento de datos para tomar un turno.',
  NO_AUTENTICADO: 'Tu sesión expiró. Inicia sesión de nuevo.',
  SIN_PERMISO: 'No tienes permiso para hacer esto.',
  TURNO_EN_CURSO: 'Primero marca el turno actual como atendido o ausente.',
  TURNO_NO_ENCONTRADO: 'No encontramos ese turno.',
  TRANSICION_INVALIDA: 'Ese turno ya cambió de estado. Actualizamos la fila.',
  ESTADO_INVALIDO: 'Estado no válido.',
  SLUG_EN_USO: 'Ese enlace ya está en uso. Inténtalo de nuevo.',
  YA_TIENES_NEGOCIO: 'Tu cuenta ya tiene un negocio registrado.',
  DATOS_INVALIDOS: 'Revisa los datos del negocio (el nombre debe tener entre 2 y 80 caracteres).',
}

const OTHER_ERRORS: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
  [/user already registered/i, 'Ese correo ya está registrado. Inicia sesión.'],
  [/email not confirmed/i, 'Debes confirmar tu correo antes de entrar. Revisa tu bandeja de entrada.'],
  [/password should be at least/i, 'La contraseña es muy corta.'],
  [/rate limit|too many requests/i, 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'],
  [/failed to fetch|networkerror|load failed/i, 'No hay conexión con el servidor. Revisa tu internet.'],
]

export function friendlyError(message?: string | null): string {
  if (!message) return 'Ocurrió un error inesperado. Inténtalo de nuevo.'
  const code = Object.keys(DB_ERRORS).find((k) => message.includes(k))
  if (code) return DB_ERRORS[code]
  const other = OTHER_ERRORS.find(([re]) => re.test(message))
  if (other) return other[1]
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.'
}

/** ¿El error indica que la sesión del administrador ya no es válida? */
export const isAuthError = (message?: string | null) => !!message && message.includes('NO_AUTENTICADO')
