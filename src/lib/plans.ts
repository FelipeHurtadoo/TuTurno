/** Planes de TuTurno. Fuente única para la página de inicio y el panel. */
export interface PlanInfo {
  id: 'free' | 'pro'
  name: string
  price: number
  period: string
  tagline: string
  features: string[]
}

export const FREE_DAILY_LIMIT = 30

export const PLANS: Record<'free' | 'pro', PlanInfo> = {
  free: {
    id: 'free',
    name: 'Gratuito',
    price: 0,
    period: 'para siempre',
    tagline: 'Para empezar a ordenar tu fila hoy mismo.',
    features: [
      `Hasta ${FREE_DAILY_LIMIT} turnos por día`,
      'Código QR y afiche imprimible',
      'Fila en tiempo real en el celular del cliente',
      'Avisos cuando se acerca el turno',
      'Panel para llamar, marcar atendido o ausente',
      'Pantalla pública para TV o tablet',
      'Logo de tu negocio',
      'Estadísticas del día',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 89900,
    period: 'al mes',
    tagline: 'Para negocios con mucho movimiento.',
    features: [
      'Todo lo del plan Gratuito',
      'Turnos ilimitados por día',
      'Sin cortes en horas pico: tu fila nunca se cierra por límite',
      'Soporte prioritario',
    ],
  },
}

export const formatCOP = (value: number) =>
  value === 0 ? '$0' : `$${value.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`
