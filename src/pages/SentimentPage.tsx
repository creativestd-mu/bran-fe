import { useCallback, useEffect, useState } from "react"
import { sentimentApi } from "@/lib/api"
import type { SentimentDashboard, SentimentPreset } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Loader2, RefreshCw, SmilePlus } from "lucide-react"

const PRESETS: Array<{ key: SentimentPreset; label: string }> = [
  { key: "7d", label: "7 days" },
  { key: "14d", label: "14 days" },
  { key: "30d", label: "30 days" },
  { key: "this_week", label: "This week" },
  { key: "this_month", label: "This month" },
]

function formatCount(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return new Intl.NumberFormat("en-IN").format(Math.round(value))
}

function formatNet(score: number): string {
  const pct = Math.round(score * 100)
  if (pct > 0) return `+${pct}`
  return String(pct)
}

function formatDay(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00.000Z`))
}

export default function SentimentPage() {
  const [data, setData] = useState<SentimentDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [preset, setPreset] = useState<SentimentPreset>("30d")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const usingCustomRange = Boolean(from || to)

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const res = await sentimentApi.dashboard(
        usingCustomRange
          ? { from: from || undefined, to: to || undefined }
          : { preset }
      )
      setData(res)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load sentiment"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [from, preset, to, usingCustomRange])

  useEffect(() => {
    void fetchDashboard()
  }, [fetchDashboard])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await sentimentApi.sync(
        usingCustomRange
          ? { from: from || undefined, to: to || undefined }
          : { from: data?.range.from, to: data?.range.to }
      )
      toast.success(`Synced ${result.stored} day${result.stored === 1 ? "" : "s"} from Meltwater`)
      await fetchDashboard()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sync Meltwater")
    } finally {
      setSyncing(false)
    }
  }

  const totals = data?.totals
  const series = data?.series ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <SmilePlus className="h-6 w-6 text-primary" />
            Sentiment
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Earned mention volume, reach, and sentiment from Meltwater. Ask Bran on Slack:
            <span className="font-medium text-foreground"> “sentiment this week”</span>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => void fetchDashboard()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button className="gap-2" onClick={() => void handleSync()} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync Meltwater
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((item) => (
            <Button
              key={item.key}
              size="sm"
              variant={!usingCustomRange && preset === item.key ? "default" : "outline"}
              onClick={() => {
                setFrom("")
                setTo("")
                setPreset(item.key)
              }}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <Input
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          className="w-40"
        />
        <Input
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          className="w-40"
        />
      </div>

      {data && (
        <p className="text-xs text-muted-foreground">
          {formatDay(data.range.from)} – {formatDay(data.range.to)} · {data.timezone}
          {data.searches.length > 0
            ? ` · ${data.searches.map((search) => search.searchName || search.searchId).join(", ")}`
            : ""}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Mentions" loading={loading} value={totals ? formatCount(totals.mentionCount) : "—"} />
        <StatCard label="Reach" loading={loading} value={totals ? formatCount(totals.reach) : "—"} />
        <StatCard
          label="Estimated views"
          loading={loading}
          value={totals ? formatCount(totals.estimatedViews) : "—"}
        />
        <StatCard
          label="Net sentiment"
          loading={loading}
          value={totals ? formatNet(totals.netSentiment) : "—"}
          hint={totals ? `Dominant: ${totals.dominant}` : undefined}
          tone={
            totals
              ? totals.netSentiment > 0
                ? "positive"
                : totals.netSentiment < 0
                  ? "negative"
                  : "neutral"
              : undefined
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sentiment mix</CardTitle>
          <CardDescription>Share of earned mentions in this window</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : totals && totals.mentionCount > 0 ? (
            <div className="space-y-3">
              <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                <div className="bg-emerald-500" style={{ width: `${totals.sentimentShare.positive}%` }} />
                <div className="bg-slate-400" style={{ width: `${totals.sentimentShare.neutral}%` }} />
                <div className="bg-rose-500" style={{ width: `${totals.sentimentShare.negative}%` }} />
                <div className="bg-zinc-500" style={{ width: `${totals.sentimentShare.unknown}%` }} />
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <Badge variant="outline">Positive {totals.sentiment.positive} ({totals.sentimentShare.positive}%)</Badge>
                <Badge variant="outline">Neutral {totals.sentiment.neutral} ({totals.sentimentShare.neutral}%)</Badge>
                <Badge variant="outline">Negative {totals.sentiment.negative} ({totals.sentimentShare.negative}%)</Badge>
                {totals.sentiment.unknown > 0 && (
                  <Badge variant="outline">Unknown {totals.sentiment.unknown} ({totals.sentimentShare.unknown}%)</Badge>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No earned mentions stored for this window yet. Sync Meltwater or widen the range.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily series</CardTitle>
          <CardDescription>Volume, reach, and sentiment by day</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : series.length === 0 ? (
            <p className="text-sm text-muted-foreground">No daily rows in this range.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Mentions</TableHead>
                  <TableHead className="text-right">Reach</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Pos</TableHead>
                  <TableHead className="text-right">Neu</TableHead>
                  <TableHead className="text-right">Neg</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {series.map((row) => (
                  <TableRow key={row.date}>
                    <TableCell>{formatDay(row.date)}</TableCell>
                    <TableCell className="text-right">{formatCount(row.mentionCount)}</TableCell>
                    <TableCell className="text-right">{formatCount(row.reach)}</TableCell>
                    <TableCell className="text-right">{formatCount(row.estimatedViews)}</TableCell>
                    <TableCell className="text-right">{row.sentiment.positive}</TableCell>
                    <TableCell className="text-right">{row.sentiment.neutral}</TableCell>
                    <TableCell className="text-right">{row.sentiment.negative}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium",
                        row.netSentiment > 0 && "text-emerald-600",
                        row.netSentiment < 0 && "text-rose-600"
                      )}
                    >
                      {formatNet(row.netSentiment)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  loading,
  tone,
}: {
  label: string
  value: string
  hint?: string
  loading: boolean
  tone?: "positive" | "negative" | "neutral"
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={cn(
            "text-3xl",
            tone === "positive" && "text-emerald-600",
            tone === "negative" && "text-rose-600"
          )}
        >
          {loading ? <Skeleton className="h-9 w-20" /> : value}
        </CardTitle>
      </CardHeader>
      {hint && !loading && (
        <CardContent className="pt-0 text-xs text-muted-foreground">{hint}</CardContent>
      )}
    </Card>
  )
}
