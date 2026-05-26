import { useState } from 'react'
import type {
  AggregateData,
  PaginationMeta,
  RecordsQuery,
  SocialRecord,
  SocialSource,
  SyncPayload,
} from '../api/social'
import { fetchAggregate, fetchRecords, syncSocial } from '../api/social'

type Nullable<T> = T | null

const EMPTY_AGGREGATE: AggregateData = {
  mentions: 0,
  estimatedViews: 0,
  estimatedReach: 0,
  engagementCount: 0,
  engagement: 0,
  sentiment: {
    positive: 0,
    neutral: 0,
    negative: 0,
    unknown: 0,
  },
  source: 'instagram',
  range: {},
}

const EMPTY_PAGINATION: PaginationMeta = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
}

const formatUnknown = (value: unknown) => {
  if (typeof value === 'string') return value
  if (value == null) return ''
  return JSON.stringify(value)
}

const formatError = (error: unknown) => {
  if (error instanceof Error) {
    const details = (error as { details?: unknown }).details
    return details ? `${error.message} (${formatUnknown(details)})` : error.message
  }
  return 'Something went wrong.'
}

export const useSocialPerformance = (source: SocialSource) => {
  const [aggregate, setAggregate] = useState<Nullable<AggregateData>>(null)
  const [records, setRecords] = useState<SocialRecord[]>([])
  const [recordsPagination, setRecordsPagination] =
    useState<PaginationMeta>(EMPTY_PAGINATION)
  const [aggregateLoading, setAggregateLoading] = useState(false)
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [aggregateError, setAggregateError] = useState('')
  const [recordsError, setRecordsError] = useState('')
  const [syncError, setSyncError] = useState('')
  const [syncMessage, setSyncMessage] = useState('')

  const loadAggregate = async (filters: SyncPayload = {}) => {
    setAggregateLoading(true)
    setAggregateError('')
    try {
      const response = await fetchAggregate(source, filters.from, filters.to)
      setAggregate(response.data ?? { ...EMPTY_AGGREGATE, source })
    } catch (error) {
      setAggregateError(formatError(error))
    } finally {
      setAggregateLoading(false)
    }
  }

  const loadRecords = async (
    filters: SyncPayload = {},
    paginationQuery: Pick<RecordsQuery, 'page' | 'pageSize'> = {},
  ) => {
    setRecordsLoading(true)
    setRecordsError('')
    try {
      const response = await fetchRecords(source, {
        from: filters.from,
        to: filters.to,
        page: paginationQuery.page,
        pageSize: paginationQuery.pageSize,
      })
      setRecords(response.data?.items ?? [])
      setRecordsPagination(response.data?.pagination ?? EMPTY_PAGINATION)
    } catch (error) {
      setRecordsError(formatError(error))
      setRecords([])
      setRecordsPagination(EMPTY_PAGINATION)
    } finally {
      setRecordsLoading(false)
    }
  }

  const refreshAll = async (
    filters: SyncPayload = {},
    paginationQuery: Pick<RecordsQuery, 'page' | 'pageSize'> = {},
  ) => {
    setSyncError('')
    setSyncMessage('')
    await Promise.all([loadAggregate(filters), loadRecords(filters, paginationQuery)])
  }

  const syncNow = async (
    filters: SyncPayload = {},
    paginationQuery: Pick<RecordsQuery, 'page' | 'pageSize'> = {},
  ) => {
    setSyncing(true)
    setSyncError('')
    setSyncMessage('')
    try {
      const response = await syncSocial(source, filters)
      const fetched = response.data?.fetched ?? 0
      const stored = response.data?.stored ?? 0
      setSyncMessage(`Sync complete. Fetched ${fetched}, stored ${stored}.`)
      await refreshAll(filters, paginationQuery)
    } catch (error) {
      setSyncError(formatError(error))
    } finally {
      setSyncing(false)
    }
  }

  return {
    aggregate,
    records,
    recordsPagination,
    aggregateLoading,
    recordsLoading,
    syncing,
    aggregateError,
    recordsError,
    syncError,
    syncMessage,
    loadAggregate,
    loadRecords,
    refreshAll,
    syncNow,
  }
}
