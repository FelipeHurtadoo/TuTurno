export type TicketStatus = 'waiting' | 'called' | 'attended' | 'absent' | 'cancelled'

export interface Business {
  id: string
  name: string
  slug: string
  plan: 'free' | 'pro'
  daily_limit: number
  logo_path?: string | null
}

export interface JoinInfo {
  found: boolean
  id?: string
  name?: string
  slug?: string
  logo_path?: string | null
  accepting?: boolean
}

export interface JoinResult {
  id: string
  number: number
  token: string
  already_had: boolean
}

export interface TicketStatusResult {
  found: boolean
  expired?: boolean
  status?: TicketStatus
  number?: number
  customer_name?: string
  business_id?: string
  business_name?: string
  business_slug?: string
  business_logo_path?: string | null
  now_serving?: number | null
  people_ahead?: number
  estimated_wait_seconds?: number | null
}

export interface PublicBoardData {
  found: boolean
  business_id?: string
  name?: string
  logo_path?: string | null
  now_serving?: number | null
  /** Nombre corto ("Laura M.") del turno en atención. */
  now_serving_name?: string | null
  next?: number[]
  next_tickets?: { number: number; name: string }[]
  waiting_count?: number
}

export interface AdminTicket {
  id: string
  number: number
  customer_name: string
  customer_phone: string | null
  status: TicketStatus
  source: 'qr' | 'manual'
  created_at: string
  called_at: string | null
  finished_at: string | null
}

export interface AdminStats {
  issued: number
  waiting: number
  called: number
  attended: number
  absent: number
  cancelled: number
  avg_wait_seconds: number | null
  plan: 'free' | 'pro'
  daily_limit: number | null
}

export interface AdminSnapshot {
  stats: AdminStats
  tickets: AdminTicket[]
}

export interface SuperAdminBusiness {
  id: string
  name: string
  slug: string
  plan: 'free' | 'pro'
  daily_limit: number
  created_at: string
  logo_path?: string | null
  issued_today: number
}

export type PlanId = 'free' | 'pro'

export interface MyPlanRequest {
  id: string
  requested_plan: PlanId
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  resolved_at: string | null
}

export interface SuperAdminPlanRequest {
  id: string
  business_id: string
  business_name: string
  business_slug: string
  current_plan: PlanId
  requested_plan: PlanId
  owner_email: string | null
  created_at: string
}
