import { useEffect, useMemo, useState } from "react"
import type { AggregateData, SocialRecord, SocialSource, SyncPayload } from "../api/social"
import { useSocialPerformance } from "../hooks/useSocialPerformance"

const SOURCE_TABS: Array<{ label: string; value: SocialSource }> = [
  { label: "Instagram", value: "instagram" },
  { label: "LinkedIn", value: "linkedin" },
  { label: "Facebook", value: "facebook" },
]

const SOURCE_LABELS: Record<SocialSource, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  facebook: "Facebook",
}

const aggregateEngagementTotal = (data: AggregateData) =>
  data.engagementCount ?? data.engagement ?? 0

const recordEngagementTotal = (record: SocialRecord) =>
  record.engagementCount ?? record.engagement ?? 0

const formatNumber = (value?: number) => new Intl.NumberFormat().format(value ?? 0)
const formatPercent = (value?: number) => `${((value ?? 0) * 100).toFixed(2)}%`
const formatDateTime = (value?: string) => {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value
  return date.toLocaleString()
}

type LinkedInMetric = {
  click_count: number
  comment_count: number
  engagements: number
  engagement_rate: number
  impression_count: number
  like_count: number
  share_count: number
  video_view: number | null
}

type LinkedInRecordView = {
  id: string
  sourceItemId: string
  url: string
  postType: string
  content: string
  accountName: string
  createdAt: string
  metrics: LinkedInMetric
}

const getObject = (value: unknown): Record<string, unknown> | undefined => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return undefined
}

const getNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const getString = (value: unknown) => (typeof value === "string" ? value : "")

const shorten = (value: string, max = 140) =>
  value.length > max ? `${value.slice(0, max).trim()}...` : value

function SocialInsightsPage() {
  const [source, setSource] = useState<SocialSource>("instagram")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState<SyncPayload>({
    from: "",
    to: "",
    keyword: "",
  })

  const {
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
  } = useSocialPerformance(source)

  useEffect(() => {
    setPage(1)
    refreshAll(filters, { page: 1, pageSize })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  const linkedInRows = useMemo<LinkedInRecordView[]>(() => {
    if (source !== "linkedin") return []
    return records.map((record) => {
      const payload = getObject(record.rawPayload)
      const account = getObject(payload?.account)
      const metricsSource = getObject(payload?.metrics)
      return {
        id: record.id,
        sourceItemId: record.sourceItemId,
        url: getString(payload?.url),
        postType: getString(payload?.post_type) || "unknown",
        content: getString(payload?.content),
        accountName: getString(account?.name) || "Unknown account",
        createdAt: getString(payload?.created_at) || record.mentionedAt,
        metrics: {
          click_count: getNumber(metricsSource?.click_count),
          comment_count: getNumber(metricsSource?.comment_count),
          engagements: getNumber(metricsSource?.engagements),
          engagement_rate: getNumber(metricsSource?.engagement_rate),
          impression_count: getNumber(metricsSource?.impression_count),
          like_count: getNumber(metricsSource?.like_count),
          share_count: getNumber(metricsSource?.share_count),
          video_view: metricsSource?.video_view == null ? null : getNumber(metricsSource.video_view),
        },
      }
    })
  }, [records, source])

  const linkedInSummary = useMemo(() => {
    if (!linkedInRows.length) return null
    const total = linkedInRows.reduce(
      (acc, row) => ({
        impressions: acc.impressions + row.metrics.impression_count,
        clicks: acc.clicks + row.metrics.click_count,
        engagements: acc.engagements + row.metrics.engagements,
        likes: acc.likes + row.metrics.like_count,
        comments: acc.comments + row.metrics.comment_count,
        shares: acc.shares + row.metrics.share_count,
        videoViews: acc.videoViews + (row.metrics.video_view ?? 0),
        weightedEngagementRate: acc.weightedEngagementRate + row.metrics.engagement_rate * row.metrics.impression_count,
        totalWeight: acc.totalWeight + row.metrics.impression_count,
      }),
      { impressions: 0, clicks: 0, engagements: 0, likes: 0, comments: 0, shares: 0, videoViews: 0, weightedEngagementRate: 0, totalWeight: 0 }
    )
    const typeCounts = linkedInRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.postType] = (acc[row.postType] ?? 0) + 1
      return acc
    }, {})
    const topByEngagements = [...linkedInRows].sort((a, b) => b.metrics.engagements - a.metrics.engagements)[0]
    const topByRate = [...linkedInRows].sort((a, b) => b.metrics.engagement_rate - a.metrics.engagement_rate)[0]
    return { ...total, avgEngagementRate: total.totalWeight > 0 ? total.weightedEngagementRate / total.totalWeight : 0, typeCounts, topByEngagements, topByRate }
  }, [linkedInRows])

  const handleApplyFilters = () => {
    setPage(1)
    refreshAll(filters, { page: 1, pageSize })
  }

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage)
    loadRecords(filters, { page: nextPage, pageSize })
  }

  const handlePageSizeChange = (nextPageSize: number) => {
    setPageSize(nextPageSize)
    setPage(1)
    loadRecords(filters, { page: 1, pageSize: nextPageSize })
  }

  return (
    <div className="social-page" style={{ padding: 0 }}>
      <section className="social-header-card">
        <h1 className="page-title">Social Insights</h1>
        <p className="page-subtitle">Unified social performance dashboard (Meltwater data)</p>

        <div className="source-tabs" role="tablist" aria-label="Select source">
          {SOURCE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={source === tab.value}
              className={`source-tab ${source === tab.value ? "is-active" : ""}`}
              onClick={() => setSource(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="filters-grid">
          <label>
            From
            <input type="datetime-local" value={filters.from ?? ""} onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))} />
          </label>
          <label>
            To
            <input type="datetime-local" value={filters.to ?? ""} onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))} />
          </label>
          <label>
            Keyword
            <input type="text" value={filters.keyword ?? ""} placeholder="Optional keyword for sync" onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))} />
          </label>
        </div>

        <div className="social-actions">
          <button type="button" onClick={handleApplyFilters} disabled={aggregateLoading || recordsLoading}>
            {aggregateLoading || recordsLoading ? "Refreshing..." : "Apply Filters"}
          </button>
          <button type="button" onClick={() => syncNow(filters, { page, pageSize })} disabled={syncing}>
            {syncing ? "Syncing..." : `Sync ${SOURCE_LABELS[source]}`}
          </button>
        </div>

        {syncError ? <p className="status-text status-error">{syncError}</p> : null}
        {syncMessage ? <p className="status-text status-success">{syncMessage}</p> : null}
      </section>

      <section className="stats-grid">
        {aggregateLoading ? (
          <article className="stat-card stat-card-wide">
            <p className="state-text">Loading aggregate metrics...</p>
          </article>
        ) : aggregateError ? (
          <article className="stat-card stat-card-wide">
            <p className="status-text status-error">{aggregateError}</p>
            <button type="button" className="retry-button" onClick={() => loadAggregate(filters)}>Retry aggregate</button>
          </article>
        ) : aggregate ? (
          <>
            <article className="stat-card"><h2>Mentions</h2><p>{formatNumber(aggregate.mentions)}</p></article>
            <article className="stat-card"><h2>Estimated Views</h2><p>{formatNumber(aggregate.estimatedViews)}</p></article>
            <article className="stat-card"><h2>Estimated Reach</h2><p>{formatNumber(aggregate.estimatedReach)}</p></article>
            <article className="stat-card"><h2>Engagement</h2><p>{formatNumber(aggregateEngagementTotal(aggregate))}</p></article>
            {typeof aggregate.engagementRateAvg === "number" ? (
              <article className="stat-card"><h2>Avg engagement rate</h2><p>{formatPercent(aggregate.engagementRateAvg)}</p></article>
            ) : null}
          </>
        ) : (
          <article className="stat-card stat-card-wide"><p className="state-text">No aggregate data yet.</p></article>
        )}
      </section>

      <section className="sentiment-card">
        <h2>Sentiment Breakdown</h2>
        {aggregateLoading ? (
          <p className="state-text">Loading sentiment...</p>
        ) : aggregate ? (
          <>
            <div className="sentiment-grid">
              <span>Positive: {formatNumber(aggregate.sentiment.positive)}</span>
              <span>Neutral: {formatNumber(aggregate.sentiment.neutral)}</span>
              <span>Negative: {formatNumber(aggregate.sentiment.negative)}</span>
              <span>Unknown: {formatNumber(aggregate.sentiment.unknown)}</span>
            </div>
            <p className="range-text">Range: {aggregate.range?.from || "-"} to {aggregate.range?.to || "-"}</p>
          </>
        ) : (
          <p className="state-text">No sentiment data.</p>
        )}
      </section>

      <section className="records-card">
        <h2>Records</h2>
        {recordsLoading ? (
          <p className="state-text">Loading records...</p>
        ) : recordsError ? (
          <div className="records-state">
            <p className="status-text status-error">{recordsError}</p>
            <button type="button" className="retry-button" onClick={() => loadRecords(filters, { page, pageSize })}>Retry records</button>
          </div>
        ) : records.length === 0 ? (
          <p className="state-text">No records found for selected filters.</p>
        ) : (
          <>
            {source === "linkedin" && linkedInSummary ? (
              <section className="linkedin-insights">
                <h3>LinkedIn Deep Insights</h3>
                <div className="linkedin-kpis">
                  <article className="linkedin-kpi"><span>Total Impressions</span><strong>{formatNumber(linkedInSummary.impressions)}</strong></article>
                  <article className="linkedin-kpi"><span>Total Clicks</span><strong>{formatNumber(linkedInSummary.clicks)}</strong></article>
                  <article className="linkedin-kpi"><span>Total Reactions</span><strong>{formatNumber(linkedInSummary.likes + linkedInSummary.comments + linkedInSummary.shares)}</strong></article>
                  <article className="linkedin-kpi"><span>Avg Engagement Rate</span><strong>{formatPercent(linkedInSummary.avgEngagementRate)}</strong></article>
                </div>
                <div className="linkedin-meta-grid">
                  <article className="linkedin-meta-card">
                    <h4>Post Type Mix</h4>
                    <ul>{Object.entries(linkedInSummary.typeCounts).map(([type, count]) => (<li key={type}><span>{type}</span><strong>{count}</strong></li>))}</ul>
                  </article>
                  <article className="linkedin-meta-card">
                    <h4>Top by Engagements</h4>
                    {linkedInSummary.topByEngagements ? (
                      <>
                        <p>{shorten(linkedInSummary.topByEngagements.content)}</p>
                        <div className="linkedin-top-meta">
                          <span>{formatNumber(linkedInSummary.topByEngagements.metrics.engagements)} engagements</span>
                          <span>{formatPercent(linkedInSummary.topByEngagements.metrics.engagement_rate)} ER</span>
                        </div>
                        {linkedInSummary.topByEngagements.url ? (<a href={linkedInSummary.topByEngagements.url} target="_blank" rel="noreferrer">Open post</a>) : null}
                      </>
                    ) : null}
                  </article>
                  <article className="linkedin-meta-card">
                    <h4>Top by Engagement Rate</h4>
                    {linkedInSummary.topByRate ? (
                      <>
                        <p>{shorten(linkedInSummary.topByRate.content)}</p>
                        <div className="linkedin-top-meta">
                          <span>{formatPercent(linkedInSummary.topByRate.metrics.engagement_rate)} ER</span>
                          <span>{formatNumber(linkedInSummary.topByRate.metrics.impression_count)} impressions</span>
                        </div>
                        {linkedInSummary.topByRate.url ? (<a href={linkedInSummary.topByRate.url} target="_blank" rel="noreferrer">Open post</a>) : null}
                      </>
                    ) : null}
                  </article>
                </div>
              </section>
            ) : null}

            <div className="records-toolbar">
              <label>
                Page size
                <select value={pageSize} onChange={(e) => handlePageSizeChange(Number(e.target.value))}>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
              <span className="pagination-text">{recordsPagination.total} total records</span>
            </div>

            <div className="records-mobile-list lg:hidden">
              {records.map((record) => {
                const linkedInRow = source === "linkedin" ? linkedInRows.find((item) => item.id === record.id) : undefined
                return (
                  <article key={record.id} className="record-mobile-card">
                    <div className="record-mobile-card-header">
                      <strong>{record.source}</strong>
                      <span>{record.sentiment}</span>
                    </div>
                    {source === "linkedin" && linkedInRow ? (
                      <p className="record-mobile-card-subtitle">{linkedInRow.accountName} · {linkedInRow.postType}</p>
                    ) : null}
                    <dl className="record-mobile-card-grid">
                      <div><dt>Source ID</dt><dd>{record.sourceItemId}</dd></div>
                      <div><dt>Engagement</dt><dd>{formatNumber(recordEngagementTotal(record))}</dd></div>
                      <div><dt>Views</dt><dd>{formatNumber(record.estimatedViews)}</dd></div>
                      <div><dt>Reach</dt><dd>{formatNumber(record.estimatedReach)}</dd></div>
                      {source === "linkedin" && linkedInRow ? (
                        <>
                          <div><dt>Impressions</dt><dd>{formatNumber(linkedInRow.metrics.impression_count)}</dd></div>
                          <div><dt>ER</dt><dd>{formatPercent(linkedInRow.metrics.engagement_rate)}</dd></div>
                        </>
                      ) : null}
                      <div className="record-mobile-card-wide"><dt>Mentioned</dt><dd>{formatDateTime(linkedInRow?.createdAt || record.mentionedAt)}</dd></div>
                    </dl>
                    {source === "linkedin" && linkedInRow?.url ? (
                      <a href={linkedInRow.url} target="_blank" rel="noreferrer" className="record-mobile-card-link">Open post</a>
                    ) : null}
                  </article>
                )
              })}
            </div>

            <div className="records-table-wrap hidden lg:block">
              <table className="records-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    {source === "linkedin" ? <th>Account</th> : null}
                    {source === "linkedin" ? <th>Type</th> : null}
                    <th>Source ID</th>
                    <th>Mention Count</th>
                    <th>Views</th>
                    <th>Reach</th>
                    <th>Engagement</th>
                    {source === "facebook" ? <th>Eng. rate</th> : null}
                    {source === "linkedin" ? <th>Impressions</th> : null}
                    {source === "linkedin" ? <th>Clicks</th> : null}
                    {source === "linkedin" ? <th>Likes</th> : null}
                    {source === "linkedin" ? <th>Comments</th> : null}
                    {source === "linkedin" ? <th>Shares</th> : null}
                    {source === "linkedin" ? <th>ER</th> : null}
                    <th>Sentiment</th>
                    <th>Mentioned At</th>
                    {source === "linkedin" ? <th>Post Link</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => {
                    const linkedInRow = source === "linkedin" ? linkedInRows.find((item) => item.id === record.id) : undefined
                    return (
                      <tr key={record.id}>
                        <td>{record.source}</td>
                        {source === "linkedin" ? <td>{linkedInRow?.accountName || "-"}</td> : null}
                        {source === "linkedin" ? <td>{linkedInRow?.postType || "-"}</td> : null}
                        <td>{record.sourceItemId}</td>
                        <td>{formatNumber(record.mentionCount)}</td>
                        <td>{formatNumber(record.estimatedViews)}</td>
                        <td>{formatNumber(record.estimatedReach)}</td>
                        <td>{formatNumber(recordEngagementTotal(record))}</td>
                        {source === "facebook" ? <td>{typeof record.engagementRate === "number" ? formatPercent(record.engagementRate) : "-"}</td> : null}
                        {source === "linkedin" ? <td>{formatNumber(linkedInRow?.metrics.impression_count)}</td> : null}
                        {source === "linkedin" ? <td>{formatNumber(linkedInRow?.metrics.click_count)}</td> : null}
                        {source === "linkedin" ? <td>{formatNumber(linkedInRow?.metrics.like_count)}</td> : null}
                        {source === "linkedin" ? <td>{formatNumber(linkedInRow?.metrics.comment_count)}</td> : null}
                        {source === "linkedin" ? <td>{formatNumber(linkedInRow?.metrics.share_count)}</td> : null}
                        {source === "linkedin" ? <td>{formatPercent(linkedInRow?.metrics.engagement_rate)}</td> : null}
                        <td>{record.sentiment}</td>
                        <td>{formatDateTime(linkedInRow?.createdAt || record.mentionedAt)}</td>
                        {source === "linkedin" ? (
                          <td>{linkedInRow?.url ? <a href={linkedInRow.url} target="_blank" rel="noreferrer">View</a> : "-"}</td>
                        ) : null}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <button type="button" className="pagination-btn" onClick={() => handlePageChange(Math.max(1, recordsPagination.page - 1))} disabled={recordsPagination.page <= 1}>Prev</button>
              <span className="pagination-text">Page {recordsPagination.page} of {recordsPagination.totalPages}</span>
              <button type="button" className="pagination-btn" onClick={() => handlePageChange(Math.min(recordsPagination.totalPages, recordsPagination.page + 1))} disabled={!recordsPagination.hasNextPage}>Next</button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export default SocialInsightsPage
