import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { escalationsApi } from "@/lib/api"
import {
  canManageEscalations,
  type EscalationItem,
  type EscalationListData,
  type EscalationPriority,
  type EscalationStatus,
  type EscalationSummary,
} from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2, RefreshCw, Search, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

const EMPTY_SUMMARY: EscalationSummary = {
  open: 0,
  inProgress: 0,
  waiting: 0,
  resolved: 0,
  closed: 0,
}

const STATUS_OPTIONS: EscalationStatus[] = [
  "open",
  "in_progress",
  "waiting",
  "resolved",
  "closed",
]

const STATUS_STYLE: Record<
  EscalationStatus,
  { label: string; className: string }
> = {
  open: { label: "Open", className: "bg-sky-500/15 text-sky-700 border-sky-500/30" },
  in_progress: {
    label: "In progress",
    className: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  },
  waiting: {
    label: "Waiting",
    className: "bg-violet-500/15 text-violet-700 border-violet-500/30",
  },
  resolved: {
    label: "Resolved",
    className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  },
  closed: {
    label: "Closed",
    className: "bg-muted text-muted-foreground border-border",
  },
}

const PRIORITY_STYLE: Record<
  EscalationPriority,
  { label: string; className: string }
> = {
  low: { label: "Low", className: "bg-muted text-muted-foreground" },
  medium: { label: "Medium", className: "bg-sky-500/10 text-sky-700" },
  high: { label: "High", className: "bg-orange-500/15 text-orange-700" },
  urgent: { label: "Urgent", className: "bg-red-500/15 text-red-700" },
}

const SUMMARY_CHIPS: Array<{
  key: keyof EscalationSummary | "total"
  label: string
  status?: EscalationStatus
}> = [
  { key: "total", label: "Total" },
  { key: "open", label: "Open", status: "open" },
  { key: "inProgress", label: "In progress", status: "in_progress" },
  { key: "waiting", label: "Waiting", status: "waiting" },
  { key: "resolved", label: "Resolved", status: "resolved" },
  { key: "closed", label: "Closed", status: "closed" },
]

function formatIstDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso))
}

function StatusBadge({ status }: { status: EscalationStatus }) {
  const config = STATUS_STYLE[status] ?? STATUS_STYLE.open
  return (
    <Badge variant="outline" className={cn("capitalize", config.className)}>
      {config.label}
    </Badge>
  )
}

function PriorityBadge({ priority }: { priority: EscalationPriority }) {
  const config = PRIORITY_STYLE[priority] ?? PRIORITY_STYLE.medium
  return (
    <Badge variant="secondary" className={cn(config.className)}>
      {config.label}
    </Badge>
  )
}

export default function EscalationsPage() {
  const { user } = useAuth()
  const canManage = canManageEscalations(user)

  const [data, setData] = useState<EscalationListData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<EscalationStatus | null>(null)
  const [activeOnly, setActiveOnly] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<EscalationItem | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [statusDraft, setStatusDraft] = useState<EscalationStatus>("open")
  const [noteDraft, setNoteDraft] = useState("")
  const [savingNote, setSavingNote] = useState(false)

  const summary = data?.summary ?? EMPTY_SUMMARY
  const items = data?.items ?? []

  const fetchList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await escalationsApi.list({
        status: statusFilter ?? undefined,
        activeOnly: statusFilter ? false : activeOnly,
        search: search.trim() || undefined,
        take: 100,
      })
      setData(res)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load escalations"
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [activeOnly, search, statusFilter])

  useEffect(() => {
    void fetchList()
  }, [fetchList])

  const summaryValue = (key: keyof EscalationSummary | "total") => {
    if (key === "total") return data?.total ?? 0
    return summary[key]
  }

  const openDetail = async (id: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)
    setNoteDraft("")
    try {
      const res = await escalationsApi.get(id)
      setDetail(res)
      setStatusDraft(res.status)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load escalation")
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await escalationsApi.sync({ days: 30 })
      toast.success(
        `Synced ${res.escalations} escalations, ${res.updates} updates` +
          (res.errors.length ? ` (${res.errors.length} errors)` : "")
      )
      await fetchList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed")
    } finally {
      setSyncing(false)
    }
  }

  const handleAnalyze = async () => {
    if (!detail) return
    setAnalyzing(true)
    try {
      const res = await escalationsApi.analyze(detail.id)
      setDetail(res)
      setStatusDraft(res.status)
      toast.success("AI analysis updated")
      await fetchList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analyze failed")
    } finally {
      setAnalyzing(false)
    }
  }

  const handleStatusSave = async () => {
    if (!detail) return
    setSavingStatus(true)
    try {
      const res = await escalationsApi.updateStatus(detail.id, { status: statusDraft })
      setDetail(res)
      toast.success(`Status set to ${STATUS_STYLE[statusDraft].label}`)
      await fetchList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status")
    } finally {
      setSavingStatus(false)
    }
  }

  const handleAddNote = async () => {
    if (!detail || !noteDraft.trim()) return
    setSavingNote(true)
    try {
      const res = await escalationsApi.addNote(detail.id, noteDraft.trim())
      setDetail(res)
      setNoteDraft("")
      toast.success("Note added")
      await fetchList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add note")
    } finally {
      setSavingNote(false)
    }
  }

  const timeline = useMemo(() => {
    if (!detail?.updates) return []
    return [...detail.updates].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  }, [detail])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-brand text-3xl tracking-wide">Escalations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Slack escalation-matrix tracker — latest context, status, and AI summary
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void fetchList()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          {canManage && (
            <Button size="sm" onClick={() => void handleSync()} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sync Slack
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {SUMMARY_CHIPS.map((chip) => {
          const active =
            chip.key === "total"
              ? !statusFilter
              : statusFilter === chip.status
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() =>
                setStatusFilter(chip.status && statusFilter !== chip.status ? chip.status : null)
              }
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/50"
              )}
            >
              {chip.label}{" "}
              <span className="font-medium text-foreground">{summaryValue(chip.key)}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search title, context, reporter…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch
            checked={activeOnly}
            onCheckedChange={setActiveOnly}
            disabled={Boolean(statusFilter)}
          />
          Active only
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Escalation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Reporter</TableHead>
              <TableHead>Latest context</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No escalations found. Try Sync Slack or clear filters.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              items.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer"
                  onClick={() => void openDetail(item.id)}
                >
                  <TableCell className="max-w-[220px]">
                    <div className="truncate font-medium">{item.title}</div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={item.priority} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {item.reporter.name ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[320px]">
                    <div className="line-clamp-2 text-sm text-muted-foreground">
                      {item.ai.summary || item.latestContext}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatIstDateTime(item.latestUpdateAt ?? item.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-6 text-left leading-snug">
              {detailLoading ? "Loading…" : detail?.title ?? "Escalation"}
            </DialogTitle>
          </DialogHeader>

          {detailLoading && (
            <div className="space-y-3 py-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          {!detailLoading && detail && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={detail.status} />
                <PriorityBadge priority={detail.priority} />
                <span className="text-sm text-muted-foreground">
                  Reporter: {detail.reporter.name ?? "—"}
                </span>
              </div>

              <section className="space-y-1">
                <h3 className="text-sm font-medium">Where it stands</h3>
                <p className="rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed">
                  {detail.ai.summary || detail.latestContext}
                </p>
                {detail.ai.blockers.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {detail.ai.blockers.map((blocker) => (
                      <li key={blocker}>{blocker}</li>
                    ))}
                  </ul>
                )}
                {detail.ai.analyzedAt && (
                  <p className="text-xs text-muted-foreground">
                    AI analyzed {formatIstDateTime(detail.ai.analyzedAt)}
                  </p>
                )}
              </section>

              <section className="space-y-1">
                <h3 className="text-sm font-medium">Original problem</h3>
                <p className="whitespace-pre-wrap rounded-lg border p-3 text-sm text-muted-foreground">
                  {detail.problemContext}
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-medium">Timeline</h3>
                <div className="max-h-56 space-y-3 overflow-y-auto rounded-lg border p-3">
                  {timeline.length === 0 && (
                    <p className="text-sm text-muted-foreground">No updates yet.</p>
                  )}
                  {timeline.map((update) => (
                    <div key={update.id} className="space-y-1 border-b border-border/60 pb-3 last:border-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {update.authorName ?? "Unknown"}
                        </span>
                        <span>{formatIstDateTime(update.createdAt)}</span>
                        {update.isManual && <Badge variant="outline">Admin</Badge>}
                        {update.inferredStatus && (
                          <Badge variant="secondary" className="capitalize">
                            {update.inferredStatus.replace(/_/g, " ")}
                          </Badge>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{update.body}</p>
                    </div>
                  ))}
                </div>
              </section>

              {canManage && (
                <section className="space-y-3 rounded-lg border p-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[160px] flex-1 space-y-1">
                      <label className="text-xs text-muted-foreground">Status</label>
                      <Select
                        value={statusDraft}
                        onValueChange={(v) => setStatusDraft(v as EscalationStatus)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((status) => (
                            <SelectItem key={status} value={status}>
                              {STATUS_STYLE[status].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={savingStatus || statusDraft === detail.status}
                      onClick={() => void handleStatusSave()}
                    >
                      {savingStatus ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      Update status
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={analyzing}
                      onClick={() => void handleAnalyze()}
                    >
                      {analyzing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Re-analyze
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Add note</label>
                    <Input
                      placeholder="Admin update…"
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                    />
                    <Button
                      size="sm"
                      disabled={savingNote || !noteDraft.trim()}
                      onClick={() => void handleAddNote()}
                    >
                      {savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Save note
                    </Button>
                  </div>
                </section>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
