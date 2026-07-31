import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { eventsApi } from "@/lib/api"
import type {
  OrgEvent,
  OrgEventSourceCandidate,
  OrgEventSourceType,
  OrgEventStatus,
  OrgEventUpdate,
} from "@/types"
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
import {
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  Link2,
  Loader2,
  Mail,
  Pencil,
  Sparkles,
  Trash2,
  TriangleAlert,
  Video,
} from "lucide-react"

const STATUS_OPTIONS: OrgEventStatus[] = ["planned", "active", "completed", "cancelled"]

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

const SOURCE_FILTERS: Array<{
  value: "all" | Exclude<OrgEventSourceType, "MANUAL">
  label: string
}> = [
  { value: "all", label: "All sources" },
  { value: "GMAIL", label: "Gmail" },
  { value: "MEETING", label: "Meeting" },
  { value: "ESCALATION", label: "Escalation" },
  { value: "WORK_UNIT", label: "Work unit" },
]

function statusBadgeClass(status: string): string {
  return STATUS_BADGE[status as OrgEventStatus] ?? "border-border/70 bg-card/55 text-muted-foreground"
}

function confidencePct(confidence: number | null | undefined): number | null {
  if (confidence == null || Number.isNaN(confidence)) return null
  return confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence)
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso))
}

function SourceIcon({ sourceType }: { sourceType: string }) {
  const className = "h-3.5 w-3.5"
  switch (sourceType) {
    case "GMAIL":
      return <Mail className={className} />
    case "MEETING":
      return <Video className={className} />
    case "ESCALATION":
      return <TriangleAlert className={className} />
    case "ATTENDANCE":
      return <Calendar className={className} />
    case "WORK_UNIT":
      return <CheckSquare className={className} />
    case "MANUAL":
      return <Pencil className={className} />
    default:
      return <Link2 className={className} />
  }
}

function sourceLabel(sourceType: string): string {
  switch (sourceType) {
    case "GMAIL":
      return "Gmail"
    case "MEETING":
      return "Meeting"
    case "ESCALATION":
      return "Escalation"
    case "ATTENDANCE":
      return "Attendance"
    case "WORK_UNIT":
      return "Work unit"
    case "MANUAL":
      return "Note"
    default:
      return sourceType
  }
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [event, setEvent] = useState<OrgEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingStatus, setSavingStatus] = useState(false)
  const [savingTitle, setSavingTitle] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState("")

  const [noteTitle, setNoteTitle] = useState("")
  const [noteBody, setNoteBody] = useState("")
  const [savingNote, setSavingNote] = useState(false)

  const [attachOpen, setAttachOpen] = useState(false)
  const [sources, setSources] = useState<OrgEventSourceCandidate[]>([])
  const [sourcesLoading, setSourcesLoading] = useState(false)
  const [sourceFilter, setSourceFilter] = useState<"all" | Exclude<OrgEventSourceType, "MANUAL">>(
    "all"
  )
  const [attachingId, setAttachingId] = useState<string | null>(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [expandedBodies, setExpandedBodies] = useState<Record<string, boolean>>({})

  const fetchEvent = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const next = await eventsApi.get(id)
      setEvent(next)
      setTitleDraft(next.title)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load event"
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void fetchEvent()
  }, [fetchEvent])

  const updates = useMemo(() => {
    const list = event?.updates ?? []
    return [...list].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    )
  }, [event?.updates])

  const loadUnattached = useCallback(async () => {
    setSourcesLoading(true)
    try {
      const res = await eventsApi.unattachedSources({
        limit: 50,
        days: 30,
        sourceType: sourceFilter === "all" ? undefined : sourceFilter,
      })
      setSources(Array.isArray(res.sources) ? res.sources : [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load unattached sources")
      setSources([])
    } finally {
      setSourcesLoading(false)
    }
  }, [sourceFilter])

  useEffect(() => {
    if (!attachOpen) return
    void loadUnattached()
  }, [attachOpen, loadUnattached])

  const handleStatusChange = async (status: OrgEventStatus) => {
    if (!event || event.status === status) return
    setSavingStatus(true)
    try {
      const next = await eventsApi.update(event.id, { status })
      setEvent(next)
      toast.success("Status updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status")
    } finally {
      setSavingStatus(false)
    }
  }

  const saveTitle = async () => {
    if (!event || event.kind !== "MANUAL") {
      setEditingTitle(false)
      return
    }
    const title = titleDraft.trim()
    if (!title) {
      toast.error("Title is required")
      setTitleDraft(event.title)
      setEditingTitle(false)
      return
    }
    if (title === event.title) {
      setEditingTitle(false)
      return
    }
    setSavingTitle(true)
    try {
      const next = await eventsApi.update(event.id, { title })
      setEvent(next)
      setTitleDraft(next.title)
      setEditingTitle(false)
      toast.success("Title updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update title")
    } finally {
      setSavingTitle(false)
    }
  }

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!event) return
    const body = noteBody.trim()
    if (!body) {
      toast.error("Note body is required")
      return
    }
    setSavingNote(true)
    try {
      const next = await eventsApi.addNote(event.id, {
        body,
        title: noteTitle.trim() || undefined,
      })
      setEvent(next)
      setNoteBody("")
      setNoteTitle("")
      toast.success("Note added")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add note")
    } finally {
      setSavingNote(false)
    }
  }

  const handleAttach = async (source: OrgEventSourceCandidate) => {
    if (!event) return
    const key = `${source.sourceType}:${source.sourceId}`
    setAttachingId(key)
    try {
      const next = await eventsApi.attach(event.id, {
        sourceType: source.sourceType,
        sourceId: source.sourceId,
      })
      setEvent(next)
      toast.success("Source attached")
      await loadUnattached()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to attach source")
    } finally {
      setAttachingId(null)
    }
  }

  const handleDelete = async () => {
    if (!event) return
    setDeleting(true)
    try {
      await eventsApi.remove(event.id)
      toast.success("Event deleted")
      navigate("/events")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete event")
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/events">
            <ChevronLeft className="h-4 w-4" />
            Back to events
          </Link>
        </Button>
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center text-sm text-destructive">
          {error || "Event not found"}
        </p>
      </div>
    )
  }

  const isManual = event.kind === "MANUAL"
  const isAuto = event.kind === "AUTO"
  const confidence = confidencePct(event.confidence)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
            <Link to="/events">
              <ChevronLeft className="h-4 w-4" />
              Events
            </Link>
          </Button>

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
            {confidence != null && (
              <Badge variant="outline" className="border-accent/20 bg-accent/10 text-accent">
                AI · {confidence}%
              </Badge>
            )}
          </div>

          {editingTitle && isManual ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    void saveTitle()
                  }
                  if (e.key === "Escape") {
                    setTitleDraft(event.title)
                    setEditingTitle(false)
                  }
                }}
                className="max-w-xl text-lg font-semibold"
                autoFocus
                disabled={savingTitle}
              />
              <Button size="sm" onClick={() => void saveTitle()} disabled={savingTitle}>
                {savingTitle ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setTitleDraft(event.title)
                  setEditingTitle(false)
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <button
              type="button"
              className={cn(
                "text-left font-brand text-2xl tracking-wide text-accent",
                isManual && "cursor-pointer underline-offset-4 hover:underline"
              )}
              onClick={() => {
                if (isManual) setEditingTitle(true)
              }}
              title={isManual ? "Click to edit title" : undefined}
            >
              {event.title}
              {isManual && <Pencil className="ml-2 inline h-4 w-4 opacity-50" />}
            </button>
          )}

          {event.description && (
            <p className="max-w-3xl text-sm text-muted-foreground">{event.description}</p>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Created by {event.createdBy?.name || event.createdBy?.email || "—"}</span>
            <span>Starts {formatDateTime(event.startsAt)}</span>
            <span>Ends {formatDateTime(event.endsAt)}</span>
            <span title={event.createdAt}>Created {formatRelativeTime(event.createdAt)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={String(event.status)}
            onValueChange={(v) => void handleStatusChange(v as OrgEventStatus)}
            disabled={savingStatus}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  <span className="inline-flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-block h-2 w-2 rounded-full",
                        status === "planned" && "bg-slate-400",
                        status === "active" && "bg-blue-500",
                        status === "completed" && "bg-emerald-500",
                        status === "cancelled" && "bg-zinc-400"
                      )}
                    />
                    {status}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className={cn(statusBadgeClass(String(event.status)))}>
            {String(event.status)}
          </Badge>
          {isManual && (
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {event.aiSummary && (
        <Card className="border-accent/25 bg-accent/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-accent" />
              AI summary
            </CardTitle>
            <CardDescription>
              {event.aiAnalyzedAt
                ? `Analyzed ${formatRelativeTime(event.aiAnalyzedAt)} · ${formatDateTime(event.aiAnalyzedAt)}`
                : "Generated by Bran"}
              {confidence != null ? ` · ${confidence}% confidence` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{event.aiSummary}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Timeline</h2>
          <Button variant="outline" size="sm" onClick={() => setAttachOpen(true)}>
            <Link2 className="h-4 w-4" />
            Attach source
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add note</CardTitle>
            <CardDescription>Append a manual update to this event’s timeline.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleAddNote}>
              <Input
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Title (optional)"
              />
              <Textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="What happened?"
                required
              />
              <Button type="submit" disabled={savingNote}>
                {savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                Add note
              </Button>
            </form>
          </CardContent>
        </Card>

        {updates.length === 0 ? (
          <p className="rounded-lg border border-border/70 bg-card/40 p-8 text-center text-sm text-muted-foreground">
            No updates yet. Add a note or attach an unlinked source.
          </p>
        ) : (
          <div className="space-y-2">
            {updates.map((update) => (
              <TimelineRow
                key={update.id}
                update={update}
                expanded={Boolean(expandedBodies[update.id])}
                onToggle={() =>
                  setExpandedBodies((prev) => ({
                    ...prev,
                    [update.id]: !prev[update.id],
                  }))
                }
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Attach source</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select
              value={sourceFilter}
              onValueChange={(v) =>
                setSourceFilter(v as "all" | Exclude<OrgEventSourceType, "MANUAL">)
              }
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_FILTERS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {sourcesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : sources.length === 0 ? (
                <p className="rounded-lg border border-border/70 bg-card/40 p-6 text-center text-sm text-muted-foreground">
                  No unattached sources in this window.
                </p>
              ) : (
                sources.map((source) => {
                  const key = `${source.sourceType}:${source.sourceId}`
                  const attaching = attachingId === key
                  return (
                    <div
                      key={key}
                      className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card/55 p-3 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="gap-1">
                            <SourceIcon sourceType={source.sourceType} />
                            {sourceLabel(source.sourceType)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(source.occurredAt)}
                          </span>
                        </div>
                        <p className="truncate text-sm font-medium">{source.title || "Untitled"}</p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">{source.body}</p>
                        {source.actorName && (
                          <p className="text-xs text-muted-foreground">{source.actorName}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={attaching}
                        onClick={() => void handleAttach(source)}
                      >
                        {attaching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Attach"}
                      </Button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete event?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently removes “{event.title}”. Timeline attachments are unlinked.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TimelineRow({
  update,
  expanded,
  onToggle,
}: {
  update: OrgEventUpdate
  expanded: boolean
  onToggle: () => void
}) {
  const body = update.body || ""
  const long = body.length > 220
  const shown = !long || expanded ? body : `${body.slice(0, 220).trimEnd()}…`
  const actor = update.actorName || update.actor?.name || update.actor?.email || "—"

  return (
    <div className="rounded-xl border border-border/70 bg-card/55 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <SourceIcon sourceType={String(update.sourceType)} />
            {sourceLabel(String(update.sourceType))}
          </Badge>
          <p className="truncate text-sm font-medium">{update.title || "Update"}</p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground" title={update.occurredAt}>
          {formatRelativeTime(update.occurredAt)}
        </span>
      </div>
      {body && (
        <div className="mt-2">
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{shown}</p>
          {long && (
            <button
              type="button"
              className="mt-1 inline-flex items-center gap-1 text-xs text-foreground underline-offset-2 hover:underline"
              onClick={onToggle}
            >
              {expanded ? "Show less" : "Show more"}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
            </button>
          )}
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">{actor}</p>
    </div>
  )
}
