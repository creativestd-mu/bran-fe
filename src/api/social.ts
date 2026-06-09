import { trackRequestEnd, trackRequestStart } from "@/lib/networkActivity"

export type SocialSource = 'facebook' | 'instagram' | 'linkedin'

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  details?: unknown
}


export interface SyncPayload {
  from?: string
  to?: string
  keyword?: string
}

export interface RecordsQuery {
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export interface SyncData {
  fetched: number
  stored: number
}

export interface SentimentBreakdown {
  positive: number
  neutral: number
  negative: number
  unknown: number
}

export interface AggregateRange {
  from?: string
  to?: string
}

export interface AggregateData {
  mentions: number
  estimatedViews: number
  estimatedReach: number
  /** Preferred (e.g. Facebook); falls back to `engagement` for legacy APIs */
  engagementCount?: number
  /** Average engagement rate for the range (e.g. Facebook aggregate) */
  engagementRateAvg?: number
  /** Legacy aggregate field (Instagram, LinkedIn) */
  engagement?: number
  sentiment: SentimentBreakdown
  source: SocialSource
  range: AggregateRange
}

export interface SocialRecord {
  id: string
  source: SocialSource
  sourceItemId: string
  language: string
  mentionCount: number
  estimatedViews: number
  estimatedReach: number
  /** Preferred (e.g. Facebook); falls back to `engagement` for legacy APIs */
  engagementCount?: number
  /** Per-record engagement rate (e.g. Facebook) */
  engagementRate?: number
  /** Legacy record field (Instagram, LinkedIn) */
  engagement?: number
  sentiment: 'positive' | 'neutral' | 'negative' | 'unknown'
  mentionedAt: string
  rawPayload: Record<string, unknown> | string
  createdAt: string
  updatedAt: string
}

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNextPage: boolean
}

export interface RecordsData {
  items: SocialRecord[]
  pagination: PaginationMeta
}

export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

const BACKEND_BASE_URL =
  import.meta.env.VITE_BACKEND_BASE_URL ?? 'http://localhost:4001'
const LANG = 'en'

const toIsoDateTime = (value?: string) => {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString()
}

const createQuery = (params: RecordsQuery = {}) => {
  const query = new URLSearchParams()
  const fromIso = toIsoDateTime(params.from)
  const toIso = toIsoDateTime(params.to)

  if (fromIso) query.set('from', fromIso)
  if (toIso) query.set('to', toIso)
  if (params.page && params.page >= 1) query.set('page', String(params.page))
  if (params.pageSize && params.pageSize >= 1)
    query.set('pageSize', String(Math.min(params.pageSize, 100)))

  const value = query.toString()
  return value ? `?${value}` : ''
}

const request = async <T>(path: string, options?: RequestInit) => {
  trackRequestStart()
  try {
    const response = await fetch(`${BACKEND_BASE_URL}${path}`, options)
    const payload = (await response.json().catch(() => ({}))) as ApiResponse<T>

    if (!response.ok || !payload.success) {
      throw new ApiError(
        payload.error || 'Request failed',
        response.status,
        payload.details,
      )
    }

    return payload
  } finally {
    trackRequestEnd()
  }
}

export const syncSocial = (source: SocialSource, payload: SyncPayload = {}) => {
  const body: SyncPayload = {}
  const fromIso = toIsoDateTime(payload.from)
  const toIso = toIsoDateTime(payload.to)
  const keyword = payload.keyword?.trim()

  if (fromIso) body.from = fromIso
  if (toIso) body.to = toIso
  if (keyword) body.keyword = keyword

  return request<SyncData>(`/${LANG}/v1/${source}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export const fetchAggregate = (source: SocialSource, from?: string, to?: string) =>
  request<AggregateData>(`/${LANG}/v1/${source}/aggregate${createQuery({ from, to })}`)

export const fetchRecords = (source: SocialSource, params: RecordsQuery = {}) =>
  request<RecordsData>(`/${LANG}/v1/${source}/records${createQuery(params)}`)
