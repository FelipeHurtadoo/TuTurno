export type TicketStatus = 'waiting' | 'called' | 'attended' | 'absent' | 'cancelled'

export interface Business {
  id: string
  name: string
  slug: string
  plan: 'free' | 'pro'
  daily_limit: number
}

export interface JoinInfo {
  found: boolean
  id?: string
  name?: string
  slug?: string
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
  now_serving?: number | null
  people_ahead?: number
  estimated_wait_seconds?: number | null
}

export interface PublicBoardData {
  found: boolean
  business_id?: string
  name?: string
  now_serving?: number | null
  next?: number[]
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
  issued_today: number
}
