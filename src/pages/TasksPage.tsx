import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { tasksApi, usersApi } from "@/lib/api"
import { hasRole } from "@/types"
import type { Task, TaskStatus, TaskType, TaskPlatform, User } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Plus, LayoutGrid, List, ChevronLeft, ChevronRight, ExternalLink, Heart, MessageCircle, Eye, Play, Share2, Repeat2, ThumbsUp, BarChart3, Loader2 } from "lucide-react"

const STATUS_COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: "PENDING", label: "Pending", color: "text-amber-400" },
  { key: "IN_PROGRESS", label: "In Progress", color: "text-blue-400" },
  { key: "COMPLETED", label: "Completed", color: "text-emerald-400" },
  { key: "CANCELLED", label: "Cancelled", color: "text-red-400" },
]

const TASK_TYPES: TaskType[] = ["CONTENT_CREATION", "TEAM_MANAGEMENT", "GENERAL"]
const PLATFORMS: TaskPlatform[] = ["YOUTUBE", "INSTAGRAM", "LINKEDIN", "FACEBOOK"]

const statusVariant = (s: string) => {
  switch (s) {
    case "COMPLETED": return "success" as const
    case "PENDING": return "warning" as const
    case "IN_PROGRESS": return "info" as const
    case "CANCELLED": return "destructive" as const
    default: return "secondary" as const
  }
}

type StatValue = number | string | null | undefined
type StatsRecord = Record<string, StatValue> & {
  source?: string
  url?: string
  caption?: string
  fetchedAt?: string
}

interface ParsedMetadata {
  platform: TaskPlatform
  stats: StatsRecord
}

const PLATFORM_STATS_KEY: Record<TaskPlatform, string> = {
  INSTAGRAM: "instagramStats",
  YOUTUBE: "youtubeStats",
  LINKEDIN: "linkedinStats",
  FACEBOOK: "facebookStats",
}

const parseTaskMetadata = (task: Task): ParsedMetadata | null => {
  if (!task.metadata) return null
  try {
    const parsed = typeof task.metadata === "string" ? JSON.parse(task.metadata) : task.metadata
    for (const platform of PLATFORMS) {
      const key = PLATFORM_STATS_KEY[platform]
      if (parsed && typeof parsed === "object" && parsed[key]) {
        return { platform, stats: parsed[key] as StatsRecord }
      }
    }
  } catch {
    return null
  }
  return null
}

const formatNumber = (value: StatValue): string => {
  if (value === null || value === undefined) return "—"
  if (typeof value === "string") {
    const num = Number(value)
    if (!Number.isNaN(num)) return formatNumber(num)
    return value
  }
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`
  return value.toLocaleString()
}

const STAT_DEFS: Record<string, { label: string; icon: typeof Heart }> = {
  likes: { label: "Likes", icon: Heart },
  comments: { label: "Comments", icon: MessageCircle },
  views: { label: "Views", icon: Eye },
  plays: { label: "Plays", icon: Play },
  shares: { label: "Shares", icon: Share2 },
  reposts: { label: "Reposts", icon: Repeat2 },
  reactions: { label: "Reactions", icon: ThumbsUp },
  impressions: { label: "Impressions", icon: BarChart3 },
  engagements: { label: "Engagements", icon: BarChart3 },
  followers: { label: "Followers", icon: ThumbsUp },
}

const STAT_ORDER = ["views", "plays", "likes", "reactions", "comments", "shares", "reposts", "impressions", "engagements", "followers"]

const getDisplayableStats = (stats: StatsRecord) => {
  const entries: { key: string; label: string; icon: typeof Heart; value: StatValue }[] = []
  const seen = new Set<string>()

  for (const key of STAT_ORDER) {
    if (key in stats && stats[key] !== null && stats[key] !== undefined) {
      entries.push({ key, label: STAT_DEFS[key].label, icon: STAT_DEFS[key].icon, value: stats[key] })
      seen.add(key)
    }
  }

  for (const [key, value] of Object.entries(stats)) {
    if (seen.has(key)) continue
    if (["source", "url", "caption", "fetchedAt"].includes(key)) continue
    if (typeof value !== "number") continue
    entries.push({ key, label: key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()), icon: BarChart3, value })
  }

  return entries
}

export default function TasksPage() {
  const { user } = useAuth()
  const isAdmin = hasRole(user, "admin", "manager")
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<"kanban" | "list">("kanban")
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 100, total: 0, totalPages: 1, hasNextPage: false })

  const [filters, setFilters] = useState({
    status: "all",
    type: "all",
    platform: "all",
    userId: "all",
  })

  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    type: "GENERAL" as TaskType,
    platform: "" as string,
    contentUrl: "",
    dueDate: "",
  })

  const fetchTasks = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page, pageSize: 100 }
      if (filters.status !== "all") params.status = filters.status
      if (filters.type !== "all") params.type = filters.type
      if (filters.platform !== "all") params.platform = filters.platform
      if (isAdmin && filters.userId !== "all") params.userId = filters.userId

      const res = await tasksApi.list(params as Parameters<typeof tasksApi.list>[0])
      setTasks(res.items)
      setPagination(res.pagination)
    } catch {
      toast.error("Failed to load tasks")
    } finally {
      setLoading(false)
    }
  }, [filters, isAdmin])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const handleCreate = async () => {
    if (!createForm.title.trim()) {
      toast.error("Title is required")
      return
    }
    setCreating(true)
    try {
      const data: Parameters<typeof tasksApi.create>[0] = {
        title: createForm.title,
        description: createForm.description || undefined,
        type: createForm.type,
        platform: createForm.type === "CONTENT_CREATION" && createForm.platform ? createForm.platform as TaskPlatform : undefined,
        contentUrl: createForm.contentUrl || undefined,
        dueDate: createForm.dueDate ? new Date(createForm.dueDate).toISOString() : undefined,
      }
      await tasksApi.create(data)
      toast.success("Task created")
      setCreateOpen(false)
      setCreateForm({ title: "", description: "", type: "GENERAL", platform: "", contentUrl: "", dueDate: "" })
      fetchTasks()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create task")
    } finally {
      setCreating(false)
    }
  }

  const updateStatus = async (task: Task, newStatus: TaskStatus) => {
    try {
      const updated = await tasksApi.update(task.id, { status: newStatus })
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)))
      if (detailTask?.id === task.id) setDetailTask(updated)
      toast.success(`Task moved to ${newStatus.replace("_", " ")}`)
    } catch {
      toast.error("Failed to update task")
    }
  }

  const tasksByStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status)

  const TaskCard = ({ task }: { task: Task }) => {
    const meta = parseTaskMetadata(task)
    const topStats = meta ? getDisplayableStats(meta.stats).slice(0, 3) : []
    return (
      <div
        className="rounded-lg border border-border bg-background p-3 space-y-2 cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => setDetailTask(task)}
      >
        <p className="text-sm font-medium leading-tight">{task.title}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-[10px]">{task.type.replace("_", " ")}</Badge>
          {task.platform && <Badge variant="outline" className="text-[10px]">{task.platform}</Badge>}
        </div>
        {topStats.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
            {topStats.map((s) => {
              const Icon = s.icon
              return (
                <span key={s.key} className="inline-flex items-center gap-1" title={s.label}>
                  <Icon className="h-3 w-3" />
                  <span className="font-medium text-foreground">{formatNumber(s.value)}</span>
                </span>
              )
            })}
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{task.user.name}</span>
          {task.dueDate && <span>{new Date(task.dueDate).toLocaleDateString()}</span>}
        </div>
      </div>
    )
  }

  const StatsPanel = ({ task }: { task: Task }) => {
    const meta = parseTaskMetadata(task)
    if (!meta) return null
    const entries = getDisplayableStats(meta.stats)
    if (entries.length === 0 && !meta.stats.caption) return null
    return (
      <div className="rounded-lg border border-border bg-background p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold">{meta.platform} Stats</h3>
          </div>
          {meta.stats.source && (
            <Badge variant="outline" className="text-[10px] uppercase">{meta.stats.source}</Badge>
          )}
        </div>
        {entries.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {entries.map((s) => {
              const Icon = s.icon
              return (
                <div key={s.key} className="rounded-md border border-border/60 bg-muted/20 p-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Icon className="h-3 w-3" />
                    <span>{s.label}</span>
                  </div>
                  <p className="mt-1 text-lg font-semibold text-accent leading-none">{formatNumber(s.value)}</p>
                </div>
              )
            })}
          </div>
        )}
        {meta.stats.caption && (
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Caption</p>
            <p className="text-xs text-foreground/90 whitespace-pre-wrap line-clamp-6">{meta.stats.caption}</p>
          </div>
        )}
        {meta.stats.fetchedAt && (
          <p className="text-[10px] text-muted-foreground">
            Fetched {new Date(meta.stats.fetchedAt).toLocaleString()}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-brand text-2xl tracking-wide text-accent">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin ? "Manage all team tasks" : "Your assigned tasks"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <Button variant={view === "kanban" ? "default" : "ghost"} size="sm" onClick={() => setView("kanban")}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={view === "list" ? "default" : "ghost"} size="sm" onClick={() => setView("list")}>
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New Task
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={filters.status} onValueChange={(v) => setFilters((p) => ({ ...p, status: v }))}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_COLUMNS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.type} onValueChange={(v) => setFilters((p) => ({ ...p, type: v }))}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {TASK_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.platform} onValueChange={(v) => setFilters((p) => ({ ...p, platform: v }))}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Platform" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : view === "kanban" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STATUS_COLUMNS.map((col) => (
            <div key={col.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className={`text-sm font-semibold ${col.color}`}>{col.label}</h3>
                <Badge variant="outline" className="text-[10px]">{tasksByStatus(col.key).length}</Badge>
              </div>
              <div className="space-y-2 min-h-[100px] rounded-lg border border-dashed border-border p-2">
                {tasksByStatus(col.key).map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
                {tasksByStatus(col.key).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">No tasks</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setDetailTask(task)}>
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{task.type.replace("_", " ")}</Badge>
                      {task.platform && <Badge variant="outline" className="text-[10px]">{task.platform}</Badge>}
                      <span className="text-xs text-muted-foreground">{task.user.name}</span>
                    </div>
                  </div>
                  <Badge variant={statusVariant(task.status)} className="text-[10px] shrink-0 ml-2">
                    {task.status.replace("_", " ")}
                  </Badge>
                </div>
              ))}
              {tasks.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No tasks found</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={(open) => { if (!creating) setCreateOpen(open) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
            <DialogDescription>Create a new task for the team</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={createForm.title} onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))} placeholder="Task title" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={createForm.description} onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={createForm.type} onValueChange={(v) => setCreateForm((p) => ({ ...p, type: v as TaskType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {createForm.type === "CONTENT_CREATION" && (
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select value={createForm.platform} onValueChange={(v) => setCreateForm((p) => ({ ...p, platform: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {createForm.type === "CONTENT_CREATION" && (
              <div className="space-y-2">
                <Label>Content URL</Label>
                <Input value={createForm.contentUrl} onChange={(e) => setCreateForm((p) => ({ ...p, contentUrl: e.target.value }))} placeholder="https://..." />
              </div>
            )}
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="datetime-local" value={createForm.dueDate} onChange={(e) => setCreateForm((p) => ({ ...p, dueDate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} className="gap-2">
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              {creating ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailTask} onOpenChange={() => setDetailTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detailTask?.title}</DialogTitle>
          </DialogHeader>
          {detailTask && (
            <div className="space-y-4">
              {detailTask.description && (
                <p className="text-sm text-muted-foreground">{detailTask.description}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{detailTask.type.replace("_", " ")}</Badge>
                {detailTask.platform && <Badge variant="outline">{detailTask.platform}</Badge>}
                <Badge variant={statusVariant(detailTask.status)}>{detailTask.status.replace("_", " ")}</Badge>
              </div>
              <div className="text-sm space-y-1 text-muted-foreground">
                <p>Assigned to: {detailTask.user.name}</p>
                {detailTask.dueDate && <p>Due: {new Date(detailTask.dueDate).toLocaleString()}</p>}
                {detailTask.completedAt && <p>Completed: {new Date(detailTask.completedAt).toLocaleString()}</p>}
                {detailTask.contentUrl && (
                  <a href={detailTask.contentUrl} target="_blank" rel="noreferrer" className="text-accent flex items-center gap-1">
                    <ExternalLink className="h-3.5 w-3.5" /> Content Link
                  </a>
                )}
              </div>
              <StatsPanel task={detailTask} />
              <div className="flex flex-wrap gap-2 pt-2">
                {STATUS_COLUMNS.filter((s) => s.key !== detailTask.status).map((s) => (
                  <Button key={s.key} variant="outline" size="sm" onClick={() => updateStatus(detailTask, s.key)}>
                    Move to {s.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
