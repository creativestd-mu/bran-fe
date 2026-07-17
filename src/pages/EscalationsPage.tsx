import { useCallback, useEffect, useState, type MouseEvent } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { escalationsApi } from "@/lib/api"
import {
  canManageEscalations,
  type EscalationItem,
  type EscalationListData,
  type EscalationStatus,
  type EscalationSummary,
} from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

/** Open is the default working state; waiting/in_progress are treated as open in the UI. */
const FILTER_CHIPS: Array<{
  key: keyof EscalationSummary | "total"
  label: string
  status?: EscalationStatus
}> = [
  { key: "open", label: "Open", status: "open" },
  { key: "resolved", label: "Resolved", status: "resolved" },
  { key: "closed", label: "Closed", status: "closed" },
  { key: "total", label: "All" },
]

const STATUS_OPTIONS: EscalationStatus[] = ["open", "resolved", "closed"]

const BADGE_BASE =
  "inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0 text-xs font-medium leading-none"

function isOpenEscalation(status: EscalationStatus): boolean {
  return status === "open" || status === "waiting" || status === "in_progress"
}

function formatIstDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso))
}

export default function EscalationsPage() {
  const { user } = useAuth()
  const canManage = canManageEscalations(user)

  const [data, setData] = useState<EscalationListData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<EscalationStatus | null>("open")
  const [syncing, setSyncing] = useState(false)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<EscalationItem | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [statusDraft, setStatusDraft] = useState<EscalationStatus>("open")
  const [noteDraft, setNoteDraft] = useState("")
  const [savingNote, setSavingNote] = useState(false)
  const [closingId, setClosingId] = useState<string | null>(null)

  const summary = data?.summary ?? EMPTY_SUMMARY
  const items = data?.items ?? []

  const fetchList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await escalationsApi.list({
        status: statusFilter ?? undefined,
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
  }, [search, statusFilter])

  useEffect(() => {
    void fetchList()
  }, [fetchList])

  const summaryValue = (key: keyof EscalationSummary | "total") => {
    if (key === "total") return data?.total ?? 0
    if (key === "open") {
      // Treat waiting / in_progress as open in the chip count.
      return summary.open + summary.inProgress + summary.waiting
    }
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
      const status =
        res.status === "waiting" || res.status === "in_progress" ? "open" : res.status
      setStatusDraft(status)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load escalation")
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleClose = async (id: string, e?: MouseEvent) => {
    e?.stopPropagation()
    setClosingId(id)
    try {
      await escalationsApi.updateStatus(id, { status: "closed" })
      toast.success("Escalation closed")
      if (detail?.id === id) {
        setDetailOpen(false)
        setDetail(null)
      }
      await fetchList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to close escalation")
    } finally {
      setClosingId(null)
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
      const status =
        res.status === "waiting" || res.status === "in_progress" ? "open" : res.status
      setStatusDraft(status)
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
      toast.success(`Marked ${statusDraft.replace(/_/g, " ")}`)
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

  return (
    <div className="min-w-0 space-y-6">
      <div className="page-header">
        <div className="min-w-0">
          <h1 className="font-brand text-2xl tracking-wide sm:text-3xl">Escalations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Slack escalation-matrix tracker
          </p>
        </div>
        <div className="page-toolbar">
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

      <div className="filter-chip-row">
        {FILTER_CHIPS.map((chip) => {
          const active =
            chip.key === "total" ? statusFilter === null : statusFilter === chip.status
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => setStatusFilter(chip.status ?? null)}
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

      <div className="relative min-w-0 w-full max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search title, context, reporter…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <>
          <div className="data-card-list flex flex-col lg:hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
          <div className="data-table-shell hidden lg:block">
            <div className="rounded-xl border bg-card">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Escalation</TableHead>
                    <TableHead>Reporter</TableHead>
                    <TableHead className="w-[140px]">Raised on</TableHead>
                    {canManage && <TableHead className="w-[100px]" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: canManage ? 4 : 3 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      ) : items.length === 0 ? (
        <p className="rounded-xl border bg-card py-10 text-center text-sm text-muted-foreground">
          No escalations found. Try Sync Slack or clear filters.
        </p>
      ) : (
        <>
          <div className="data-card-list flex flex-col lg:hidden">
            {items.map((item) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer space-y-2 rounded-xl border border-border/70 bg-card/60 p-3"
                onClick={() => void openDetail(item.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    void openDetail(item.id)
                  }
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 text-sm font-medium leading-snug">{item.title}</p>
                  {canManage && isOpenEscalation(item.status) && (
                    <button
                      type="button"
                      className={cn(
                        BADGE_BASE,
                        "border-slate-700/20 bg-slate-500/15 text-slate-800 hover:bg-slate-500/25",
                        "dark:border-transparent dark:bg-slate-600/25 dark:text-slate-300 dark:hover:bg-slate-600/40"
                      )}
                      disabled={closingId === item.id}
                      onClick={(e) => void handleClose(item.id, e)}
                    >
                      {closingId === item.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Close"
                      )}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Reporter: {item.reporter.name ?? "—"}</span>
                  <span>Raised: {formatIstDate(item.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="data-table-shell hidden lg:block">
            <div className="rounded-xl border bg-card">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Escalation</TableHead>
                    <TableHead>Reporter</TableHead>
                    <TableHead className="w-[140px]">Raised on</TableHead>
                    {canManage && <TableHead className="w-[100px]" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer"
                      onClick={() => void openDetail(item.id)}
                    >
                      <TableCell className="max-w-[420px]">
                        <div className="truncate font-medium">{item.title}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {item.reporter.name ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatIstDate(item.createdAt)}
                      </TableCell>
                      {canManage && (
                        <TableCell className="whitespace-nowrap">
                          {isOpenEscalation(item.status) ? (
                            <button
                              type="button"
                              className={cn(
                                BADGE_BASE,
                                "border-slate-700/20 bg-slate-500/15 text-slate-800 hover:bg-slate-500/25",
                                "dark:border-transparent dark:bg-slate-600/25 dark:text-slate-300 dark:hover:bg-slate-600/40"
                              )}
                              disabled={closingId === item.id}
                              onClick={(e) => void handleClose(item.id, e)}
                            >
                              {closingId === item.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Close"
                              )}
                            </button>
                          ) : null}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

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
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <span>Reporter: {detail.reporter.name ?? "—"}</span>
                <span>Raised on: {formatIstDate(detail.createdAt)}</span>
                {canManage && isOpenEscalation(detail.status) && (
                  <button
                    type="button"
                    className={cn(
                      BADGE_BASE,
                      "border-slate-700/20 bg-slate-500/15 text-slate-800 hover:bg-slate-500/25",
                      "dark:border-transparent dark:bg-slate-600/25 dark:text-slate-300 dark:hover:bg-slate-600/40"
                    )}
                    disabled={closingId === detail.id}
                    onClick={() => void handleClose(detail.id)}
                  >
                    {closingId === detail.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Close"
                    )}
                  </button>
                )}
              </div>

              <section className="space-y-1">
                <h3 className="text-sm font-medium">Issue description</h3>
                <p className="rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {detail.ai.issueDescription || detail.problemContext}
                </p>
                {(detail.attachments?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {detail.attachments!.map((file) =>
                      file.permalink ? (
                        <a
                          key={file.id}
                          href={file.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border px-2 py-1 text-xs text-primary hover:underline"
                        >
                          {file.name || "Attachment"}
                        </a>
                      ) : (
                        <Badge key={file.id} variant="outline">
                          {file.name || "Attachment"}
                        </Badge>
                      )
                    )}
                  </div>
                )}
              </section>

              {canManage && (
                <section className="space-y-3 rounded-lg border p-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[160px] flex-1 space-y-1">
                      <label className="text-xs text-muted-foreground">Mark as</label>
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
                              {status === "open"
                                ? "Open"
                                : status === "resolved"
                                  ? "Resolved"
                                  : "Closed"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        savingStatus ||
                        statusDraft ===
                          (detail.status === "waiting" || detail.status === "in_progress"
                            ? "open"
                            : detail.status)
                      }
                      onClick={() => void handleStatusSave()}
                    >
                      {savingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Save
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
