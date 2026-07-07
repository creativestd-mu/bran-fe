import { useMemo, useRef, useState } from "react"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import { tasksApi } from "@/lib/api"
import type { Task } from "@/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  Upload,
  FileSpreadsheet,
  Flame,
  Eye,
  ThumbsUp,
  MessageCircle,
  Share2,
  Bookmark,
  ExternalLink,
  Trash2,
  Download,
  Sparkles,
  Search,
  Loader2,
  Play,
  RefreshCw,
  AlertCircle,
} from "lucide-react"

interface KhushiToolModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface StatsBag {
  plays?: number | null
  views?: number | null
  likes?: number | null
  comments?: number | null
  shares?: number | null
  saves?: number | null
  reach?: number | null
  impressions?: number | null
  caption?: string | null
  thumbnailUrl?: string | null
  publishedAt?: string | null
  source?: string | null
  fetchedAt?: string | null
}

interface ReelResult {
  id: string
  url: string
  shortcode: string
  status: "pending" | "loading" | "ok" | "error"
  error?: string
  stats: StatsBag
}

const VIRAL_THRESHOLD = 100_000

const REEL_REGEX =
  /https?:\/\/(?:www\.)?instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/gi

const extractReelsFromSheet = (file: ArrayBuffer): { url: string; shortcode: string }[] => {
  const workbook = XLSX.read(file, { type: "array", cellDates: true })
  const seen = new Set<string>()
  const out: { url: string; shortcode: string }[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    })
    for (const row of rows) {
      for (const cell of row) {
        if (cell == null) continue
        const text = String(cell)
        const matches = text.matchAll(REEL_REGEX)
        for (const match of matches) {
          const fullUrl = match[0].replace(/[)\],.;]+$/, "")
          const shortcode = match[1]
          const key = shortcode.toLowerCase()
          if (seen.has(key)) continue
          seen.add(key)
          out.push({ url: fullUrl, shortcode })
        }
      }
    }
  }
  return out
}

const toNumber = (value: unknown): number | null => {
  if (value == null || value === "") return null
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const cleaned = value.replace(/[, ]/g, "").trim()
    if (!cleaned) return null
    const m = cleaned.match(/^([\d.]+)\s*([kmb])$/i)
    if (m) {
      const base = Number(m[1])
      const mult = m[2].toLowerCase() === "k" ? 1_000 : m[2].toLowerCase() === "m" ? 1_000_000 : 1_000_000_000
      return Number.isFinite(base) ? Math.round(base * mult) : null
    }
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : null
  }
  return null
}

const toStr = (value: unknown): string | null => {
  if (value == null) return null
  const s = String(value).trim()
  return s ? s : null
}

const parseStatsFromTask = (task: Task): StatsBag => {
  const result: StatsBag = {}
  if (!task.metadata) return result
  let parsed: unknown = task.metadata
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      return result
    }
  }
  if (!parsed || typeof parsed !== "object") return result
  const root = parsed as Record<string, unknown>
  const bag = (root.instagramStats ?? root.stats ?? root) as Record<string, unknown>
  if (!bag || typeof bag !== "object") return result

  result.plays = toNumber(bag.plays ?? bag.playCount ?? bag.video_play_count)
  result.views = toNumber(bag.views ?? bag.viewCount ?? bag.video_view_count)
  result.likes = toNumber(bag.likes ?? bag.likeCount ?? bag.like_count)
  result.comments = toNumber(bag.comments ?? bag.commentCount ?? bag.comment_count)
  result.shares = toNumber(bag.shares ?? bag.shareCount ?? bag.share_count)
  result.saves = toNumber(bag.saves ?? bag.saveCount ?? bag.saved)
  result.reach = toNumber(bag.reach)
  result.impressions = toNumber(bag.impressions)
  result.caption = toStr(bag.caption ?? bag.text ?? bag.title)
  result.thumbnailUrl = toStr(bag.thumbnailUrl ?? bag.thumbnail_url ?? bag.thumbnail)
  result.publishedAt = toStr(bag.publishedAt ?? bag.timestamp ?? bag.taken_at)
  result.source = toStr(bag.source)
  result.fetchedAt = toStr(bag.fetchedAt)
  return result
}

const playsOf = (s: StatsBag) => s.plays ?? s.views ?? null

const formatNumber = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat().format(n)

const formatCompact = (n: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n)

const formatDate = (value?: string | null) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

type SortKey = "plays" | "likes" | "comments" | "shares" | "saves" | "publishedAt"

const CONCURRENCY = 3

export function KhushiToolModal({ open, onOpenChange }: KhushiToolModalProps) {
  const [results, setResults] = useState<ReelResult[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [search, setSearch] = useState("")
  const [onlyViral, setOnlyViral] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>("plays")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchStatsForReel = async (reel: ReelResult): Promise<ReelResult> => {
    let createdId: string | null = null
    try {
      const task = await tasksApi.create({
        title: `Khushi Tool – ${reel.shortcode}`,
        type: "CONTENT_CREATION",
        platform: "INSTAGRAM",
        contentUrl: reel.url,
      })
      createdId = task.id
      const stats = parseStatsFromTask(task)
      const hasAnyMetric =
        stats.plays != null ||
        stats.views != null ||
        stats.likes != null ||
        stats.comments != null
      return {
        ...reel,
        status: hasAnyMetric ? "ok" : "error",
        error: hasAnyMetric ? undefined : "No stats returned",
        stats,
      }
    } catch (err) {
      return {
        ...reel,
        status: "error",
        error: err instanceof Error ? err.message : "Failed to fetch",
        stats: {},
      }
    } finally {
      if (createdId) {
        // best-effort cleanup; ignore errors (insufficient permissions, etc.)
        tasksApi.delete(createdId).catch(() => {})
      }
    }
  }

  const runFetch = async (reels: ReelResult[]) => {
    setFetching(true)
    setProgress({ done: 0, total: reels.length })
    const queue = [...reels]
    const completed: ReelResult[] = []

    const worker = async () => {
      while (queue.length) {
        const next = queue.shift()
        if (!next) break
        // mark loading
        setResults((prev) =>
          prev.map((r) => (r.id === next.id ? { ...r, status: "loading" } : r)),
        )
        const finished = await fetchStatsForReel(next)
        completed.push(finished)
        setResults((prev) => prev.map((r) => (r.id === finished.id ? finished : r)))
        setProgress((p) => ({ done: p.done + 1, total: p.total }))
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, reels.length) }, worker))
    setFetching(false)
    const ok = completed.filter((r) => r.status === "ok").length
    const failed = completed.length - ok
    if (failed === 0) toast.success(`Fetched stats for ${ok} reels`)
    else toast.warning(`Fetched ${ok} reels, ${failed} failed`)
  }

  const handleFile = async (file: File) => {
    setParsing(true)
    try {
      const buffer = await file.arrayBuffer()
      const reels = extractReelsFromSheet(buffer)
      if (!reels.length) {
        toast.error("No Instagram reel URLs found in the sheet")
        setResults([])
        setFileName(file.name)
        return
      }
      const initial: ReelResult[] = reels.map((r, idx) => ({
        id: `${file.name}-${idx}-${r.shortcode}`,
        url: r.url,
        shortcode: r.shortcode,
        status: "pending",
        stats: {},
      }))
      setResults(initial)
      setFileName(file.name)
      toast.success(`Found ${reels.length} reel${reels.length === 1 ? "" : "s"}. Fetching stats…`)
      await runFetch(initial)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : "Failed to parse file")
    } finally {
      setParsing(false)
    }
  }

  const onPickFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
    e.target.value = ""
  }

  const retryFailed = async () => {
    const failed = results.filter((r) => r.status === "error")
    if (!failed.length) {
      toast.info("Nothing to retry")
      return
    }
    await runFetch(failed)
  }

  const exportToExcel = () => {
    if (!results.length) return
    const rows = results.map((r) => ({
      "Reel URL": r.url,
      Shortcode: r.shortcode,
      Status: r.status,
      Error: r.error ?? "",
      Plays: r.stats.plays ?? r.stats.views ?? "",
      Views: r.stats.views ?? "",
      Likes: r.stats.likes ?? "",
      Comments: r.stats.comments ?? "",
      Shares: r.stats.shares ?? "",
      Saves: r.stats.saves ?? "",
      Reach: r.stats.reach ?? "",
      Impressions: r.stats.impressions ?? "",
      Caption: r.stats.caption ?? "",
      "Posted At": r.stats.publishedAt ?? "",
      Viral: (playsOf(r.stats) ?? 0) >= VIRAL_THRESHOLD ? "Yes" : "No",
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Reel Stats")
    const stamp = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `khushi-tool-reel-stats-${stamp}.xlsx`)
    toast.success("Exported to Excel")
  }

  const stats = useMemo(() => {
    const ok = results.filter((r) => r.status === "ok")
    const totalPlays = ok.reduce((acc, r) => acc + (playsOf(r.stats) ?? 0), 0)
    const totalLikes = ok.reduce((acc, r) => acc + (r.stats.likes ?? 0), 0)
    const totalComments = ok.reduce((acc, r) => acc + (r.stats.comments ?? 0), 0)
    const viral = ok.filter((r) => (playsOf(r.stats) ?? 0) >= VIRAL_THRESHOLD).length
    const playsList = ok.map((r) => playsOf(r.stats) ?? 0)
    const avgPlays = playsList.length ? Math.round(totalPlays / playsList.length) : 0
    const top = ok.reduce<ReelResult | null>((best, r) => {
      const p = playsOf(r.stats) ?? 0
      if (!best || p > (playsOf(best.stats) ?? 0)) return r
      return best
    }, null)
    return {
      total: results.length,
      ok: ok.length,
      failed: results.filter((r) => r.status === "error").length,
      totalPlays,
      totalLikes,
      totalComments,
      viral,
      avgPlays,
      top,
    }
  }, [results])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = results
    if (onlyViral) list = list.filter((r) => (playsOf(r.stats) ?? 0) >= VIRAL_THRESHOLD)
    if (q) {
      list = list.filter(
        (r) =>
          r.url.toLowerCase().includes(q) ||
          r.shortcode.toLowerCase().includes(q) ||
          (r.stats.caption?.toLowerCase().includes(q) ?? false),
      )
    }
    const sorted = [...list].sort((a, b) => {
      const av = sortKey === "plays" ? playsOf(a.stats) : a.stats[sortKey] as number | string | null | undefined
      const bv = sortKey === "plays" ? playsOf(b.stats) : b.stats[sortKey] as number | string | null | undefined
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (sortKey === "publishedAt") {
        const at = new Date(av as string).valueOf()
        const bt = new Date(bv as string).valueOf()
        return sortDir === "asc" ? at - bt : bt - at
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
    return sorted
  }, [results, search, onlyViral, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const clearAll = () => {
    setResults([])
    setFileName(null)
    setSearch("")
    setOnlyViral(false)
    setProgress({ done: 0, total: 0 })
  }

  const progressPct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  const busy = parsing || fetching

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1rem)] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-accent">
            <Sparkles className="h-5 w-5 text-pink-500" />
            Khushi&apos;s Tool — Instagram Reels Analyzer
          </DialogTitle>
          <DialogDescription>
            Upload an Excel sheet containing Instagram reel links. The tool fetches
            live stats for each reel and highlights the ones that have crossed{" "}
            <span className="font-semibold text-accent">100k plays</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Card className="border-dashed">
            <CardContent className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-pink-500/10 text-pink-500">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{fileName ?? "No file selected"}</p>
                  <p className="text-xs text-muted-foreground">
                    Accepts .xlsx, .xls, .csv. Just paste reel URLs in any column —
                    headers are not required.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={onPickFile}
                />
                <Button
                  onClick={() => inputRef.current?.click()}
                  disabled={busy}
                  className="gap-2"
                  type="button"
                >
                  {parsing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {parsing
                    ? "Parsing…"
                    : results.length
                      ? "Replace File"
                      : "Upload Excel"}
                </Button>
                {results.length > 0 && (
                  <>
                    <Button
                      variant="outline"
                      onClick={exportToExcel}
                      disabled={busy}
                      className="gap-2"
                      type="button"
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                    {stats.failed > 0 && (
                      <Button
                        variant="outline"
                        onClick={retryFailed}
                        disabled={busy}
                        className="gap-2"
                        type="button"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Retry failed ({stats.failed})
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onClick={clearAll}
                      disabled={busy}
                      className="gap-2 text-destructive hover:text-destructive"
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                      Clear
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {fetching && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-pink-500" />
                    Fetching stats…
                  </span>
                  <span className="text-muted-foreground">
                    {progress.done} / {progress.total}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-pink-500 transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {results.length > 0 && !fetching && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <SummaryCard label="Reels" value={stats.total.toString()} />
              <SummaryCard
                label="Total Plays"
                value={formatCompact(stats.totalPlays)}
                icon={<Play className="h-4 w-4" />}
              />
              <SummaryCard label="Avg Plays" value={formatCompact(stats.avgPlays)} />
              <SummaryCard
                label="Total Likes"
                value={formatCompact(stats.totalLikes)}
                icon={<ThumbsUp className="h-4 w-4" />}
              />
              <SummaryCard
                label="Viral (100k+)"
                value={stats.viral.toString()}
                highlight={stats.viral > 0}
                icon={<Flame className="h-4 w-4" />}
              />
            </div>
          )}

          {!fetching && stats.top && (playsOf(stats.top.stats) ?? 0) >= VIRAL_THRESHOLD && (
            <Card className="border-pink-500/40 bg-gradient-to-r from-pink-500/10 via-fuchsia-500/5 to-transparent">
              <CardContent className="p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <Flame className="h-5 w-5 text-pink-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-accent">Top performing reel</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {stats.top.stats.caption ?? stats.top.url}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge className="bg-pink-500 hover:bg-pink-500">
                    {formatCompact(playsOf(stats.top.stats) ?? 0)} plays
                  </Badge>
                  <a
                    href={stats.top.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs inline-flex items-center gap-1 text-pink-500 hover:underline"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

          {results.length > 0 && (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search caption, URL, or shortcode"
                    className="pl-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={onlyViral ? "default" : "outline"}
                    size="sm"
                    onClick={() => setOnlyViral((v) => !v)}
                    className="gap-2"
                    type="button"
                  >
                    <Flame className="h-4 w-4" />
                    {onlyViral ? "Showing viral only" : "Show viral only"}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[36%]">Reel</TableHead>
                      <SortableHead label="Plays" active={sortKey === "plays"} dir={sortDir} onClick={() => toggleSort("plays")} />
                      <SortableHead label="Likes" active={sortKey === "likes"} dir={sortDir} onClick={() => toggleSort("likes")} />
                      <SortableHead label="Comments" active={sortKey === "comments"} dir={sortDir} onClick={() => toggleSort("comments")} />
                      <SortableHead label="Shares" active={sortKey === "shares"} dir={sortDir} onClick={() => toggleSort("shares")} />
                      <SortableHead label="Saves" active={sortKey === "saves"} dir={sortDir} onClick={() => toggleSort("saves")} />
                      <SortableHead label="Posted" active={sortKey === "publishedAt"} dir={sortDir} onClick={() => toggleSort("publishedAt")} />
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => {
                      const plays = playsOf(row.stats)
                      const isViral = (plays ?? 0) >= VIRAL_THRESHOLD
                      return (
                        <TableRow
                          key={row.id}
                          className={cn(
                            isViral && "bg-pink-500/10 hover:bg-pink-500/15 border-l-2 border-l-pink-500",
                          )}
                        >
                          <TableCell className="max-w-0">
                            <div className="space-y-1 min-w-0">
                              <p className="text-sm font-medium line-clamp-2">
                                {row.stats.caption ?? `Reel ${row.shortcode}`}
                              </p>
                              <a
                                href={row.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-accent hover:underline truncate max-w-full"
                              >
                                <ExternalLink className="h-3 w-3 shrink-0" />
                                <span className="truncate">{row.url}</span>
                              </a>
                            </div>
                          </TableCell>
                          <TableCell className={cn("tabular-nums font-medium", isViral && "text-pink-500 font-semibold")}>
                            <MetricCell icon={<Eye className="h-3.5 w-3.5 opacity-60" />} value={plays} />
                          </TableCell>
                          <TableCell className="tabular-nums">
                            <MetricCell icon={<ThumbsUp className="h-3.5 w-3.5 opacity-60" />} value={row.stats.likes} />
                          </TableCell>
                          <TableCell className="tabular-nums">
                            <MetricCell icon={<MessageCircle className="h-3.5 w-3.5 opacity-60" />} value={row.stats.comments} />
                          </TableCell>
                          <TableCell className="tabular-nums">
                            <MetricCell icon={<Share2 className="h-3.5 w-3.5 opacity-60" />} value={row.stats.shares} />
                          </TableCell>
                          <TableCell className="tabular-nums">
                            <MetricCell icon={<Bookmark className="h-3.5 w-3.5 opacity-60" />} value={row.stats.saves} />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(row.stats.publishedAt)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge result={row} isViral={isViral} />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                          No reels match your filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {results.length === 0 && !parsing && (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center space-y-2">
                <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Upload an Excel file with Instagram reel URLs to see live stats here.
                </p>
                <p className="text-xs text-muted-foreground">
                  Reels with 100k+ plays will be highlighted automatically.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MetricCell({ icon, value }: { icon: React.ReactNode; value: number | null | undefined }) {
  return (
    <span className="inline-flex items-center gap-1">
      {icon}
      {formatNumber(value)}
    </span>
  )
}

function StatusBadge({ result, isViral }: { result: ReelResult; isViral: boolean }) {
  if (result.status === "loading") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading
      </Badge>
    )
  }
  if (result.status === "pending") {
    return <Badge variant="outline">Pending</Badge>
  }
  if (result.status === "error") {
    return (
      <Badge variant="destructive" className="gap-1" title={result.error}>
        <AlertCircle className="h-3 w-3" />
        Failed
      </Badge>
    )
  }
  if (isViral) {
    return (
      <Badge className="bg-pink-500 hover:bg-pink-500 gap-1">
        <Flame className="h-3 w-3" />
        Viral
      </Badge>
    )
  }
  return <Badge variant="secondary">Normal</Badge>
}

function SummaryCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string
  value: string
  icon?: React.ReactNode
  highlight?: boolean
}) {
  return (
    <Card
      className={cn(
        highlight && "border-pink-500/50 bg-gradient-to-br from-pink-500/15 to-transparent",
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{label}</p>
          {icon && (
            <span className={cn("text-muted-foreground", highlight && "text-pink-500")}>
              {icon}
            </span>
          )}
        </div>
        <p className={cn("text-2xl font-bold mt-1", highlight ? "text-pink-500" : "text-accent")}>
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

function SortableHead({
  label,
  active,
  dir,
  onClick,
}: {
  label: string
  active: boolean
  dir: "asc" | "desc"
  onClick: () => void
}) {
  return (
    <TableHead>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground transition-colors",
          active && "text-foreground",
        )}
      >
        {label}
        {active && <span className="text-xs">{dir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </TableHead>
  )
}
