import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { eventsApi } from "@/lib/api"
import type { OrgEvent, OrgEventKind, OrgEventStatus, OrgEventsListData } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { cn, formatRelativeTime } from "@/lib/utils"
import { toast } from "sonner"
import { CalendarClock, Loader2, Plus, Sparkles } from "lucide-react"

const EMPTY_SUMMARY: OrgEventsListData["summary"] = {
  total: 0,
  manual: 0,
  auto: 0,
  active: 0,
}

const STATUS_OPTIONS: Array<{ value: OrgEventStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
]

const KIND_OPTIONS: Array<{ value: OrgEventKind | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "MANUAL", label: "Manual" },
  { value: "AUTO", label: "Auto" },
]

const STATUS_BADGE: Record<OrgEventStatus, string> = {
  planned:
    "border-slate-700/20 bg-slate-500/15 text-slate-800 dark:border-transparent dark:bg-slate-600/20 dark:text-slate-300",
  active:
    "border-blue-700/20 bg-blue-500/15 text-blue-800 dark:border-transparent dark:bg-blue-600/20 dark:text-blue-400",
  completed:
    "border-emerald-700/20 bg-emerald-500/15 text-emerald-800 dark:border-transparent dark:bg-emerald-600/20 dark:text-emerald-400",
  cancelled:
    "border-zinc-700/20 bg-zinc-500/15 text-zinc-700 dark:border-transparent dark:bg-zinc-600/20 dark:text-zinc-400",
}

function statusBadgeClass(status: string): string {
  return STATUS_BADGE[status as OrgEventStatus] ?? "border-border/70 bg-card/55 text-muted-foreground"
}

function confidenceLabel(confidence: number | null | undefined): string | null {
  if (confidence == null || Number.isNaN(confidence)) return null
  const pct = confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence)
  return `AI · ${pct}%`
}

const emptyCreate = {
  title: "",
  description: "",
  status: "planned" as OrgEventStatus,
  startsAt: "",
  endsAt: "",
}

export default function EventsPage() {
  const [data, setData] = useState<OrgEventsListData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<OrgEventStatus | "all">("all")
  const [kindFilter, setKindFilter] = useState<OrgEventKind | "all">("all")
  const [detecting, setDetecting] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(emptyCreate)
  const [creating, setCreating] = useState(false)

  const summary = data?.summary ?? EMPTY_SUMMARY
  const events = data?.events ?? []

  const fetchList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await eventsApi.list({
        limit: 100,
        status: statusFilter === "all" ? undefined : statusFilter,
        kind: kindFilter === "all" ? undefined : kindFilter,
      })
      setData(res)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load events"
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, kindFilter])

  useEffect(() => {
    void fetchList()
  }, [fetchList])

  const handleDetect = async () => {
    setDetecting(true)
    try {
      const result = await eventsApi.detect()
      if (result.skipped) {
        toast.message("No new activity to cluster.")
      } else {
        toast.success(
          `Created ${result.created} event${result.created === 1 ? "" : "s"}, attached ${result.attached} update${result.attached === 1 ? "" : "s"}.`
        )
      }
      await fetchList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to run detection")
    } finally {
      setDetecting(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const title = createForm.title.trim()
    if (!title) {
      toast.error("Title is required")
      return
    }
    setCreating(true)
    try {
      await eventsApi.create({
        title,
        description: createForm.description.trim() || null,
        status: createForm.status,
        startsAt: createForm.startsAt ? new Date(createForm.startsAt).toISOString() : null,
        endsAt: createForm.endsAt ? new Date(createForm.endsAt).toISOString() : null,
      })
      toast.success("Event created")
      setCreateOpen(false)
      setCreateForm(emptyCreate)
      await fetchList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create event")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-brand text-2xl tracking-wide text-accent">Events</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Org timeline of launches, workshops, and AI-clustered topics from Gmail, Meet,
            escalations, attendance, and work units.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5 border border-border/70"
            onClick={() => void handleDetect()}
            disabled={detecting}
            title="Scan Gmail, Meet, and related sources for new events"
          >
            {detecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Detect now
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setCreateForm(emptyCreate)
              setCreateOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            New event
          </Button>
        </div>
      </div>

      <div className="filter-chip-row sm:flex-wrap sm:overflow-visible">
        {(
          [
            { key: "total", label: "Total", value: summary.total },
            { key: "manual", label: "Manual", value: summary.manual },
            { key: "auto", label: "Auto", value: summary.auto },
            { key: "active", label: "Active", value: summary.active },
          ] as const
        ).map((chip) => (
          <div
            key={chip.key}
            className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card/55 px-3 py-1.5 text-sm"
          >
            <span className="text-muted-foreground">{chip.label}</span>
            <span className="font-semibold tabular-nums">{chip.value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as OrgEventStatus | "all")}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="filter-chip-row sm:overflow-visible">
            {KIND_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={kindFilter === opt.value ? "default" : "outline"}
                onClick={() => setKindFilter(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center text-sm text-destructive">
          {error}
        </p>
      ) : events.length === 0 ? (
        <p className="rounded-lg border border-border/70 bg-card/40 p-8 text-center text-sm text-muted-foreground">
          No events yet. Create a manual event or hit Detect now to cluster recent activity.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New event</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="space-y-2">
              <Label htmlFor="event-title">Title</Label>
              <Input
                id="event-title"
                value={createForm.title}
                onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Product launch"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-description">Description (optional)</Label>
              <Textarea
                id="event-description"
                value={createForm.description}
                onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="What this org event is about…"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={createForm.status}
                onValueChange={(v) =>
                  setCreateForm((p) => ({ ...p, status: v as OrgEventStatus }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.filter((o) => o.value !== "all").map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="event-starts">Starts (optional)</Label>
                <Input
                  id="event-starts"
                  type="datetime-local"
                  value={createForm.startsAt}
                  onChange={(e) => setCreateForm((p) => ({ ...p, startsAt: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-ends">Ends (optional)</Label>
                <Input
                  id="event-ends"
                  type="datetime-local"
                  value={createForm.endsAt}
                  onChange={(e) => setCreateForm((p) => ({ ...p, endsAt: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EventCard({ event }: { event: OrgEvent }) {
  const isAuto = event.kind === "AUTO"
  const confidence = isAuto ? confidenceLabel(event.confidence) : null

  return (
    <Link to={`/events/${event.id}`} className="group block h-full">
      <Card className="flex h-full flex-col transition-colors group-hover:border-primary/40 group-hover:bg-card/80">
        <CardHeader className="space-y-3 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                isAuto
                  ? "border-accent/30 bg-accent/15 text-accent"
                  : "border-border/70 bg-muted/40 text-muted-foreground"
              )}
            >
              {isAuto ? (
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Auto
                </span>
              ) : (
                "Manual"
              )}
            </Badge>
            <Badge variant="outline" className={cn(statusBadgeClass(event.status))}>
              {String(event.status)}
            </Badge>
            {confidence && (
              <Badge variant="outline" className="border-accent/20 bg-accent/10 text-accent">
                {confidence}
              </Badge>
            )}
          </div>
          <CardTitle className="line-clamp-2 min-h-[2.5rem] break-words text-base leading-snug">
            {event.title}
          </CardTitle>
          <CardDescription className="line-clamp-2 min-h-[2.5rem] break-words">
            {event.description || "\u00a0"}
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-auto flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            {event.updateCount} update{event.updateCount === 1 ? "" : "s"}
          </span>
          <span title={event.latestUpdateAt ?? undefined}>
            {event.latestUpdateAt
              ? formatRelativeTime(event.latestUpdateAt)
              : formatRelativeTime(event.createdAt)}
          </span>
        </CardContent>
      </Card>
    </Link>
  )
}
