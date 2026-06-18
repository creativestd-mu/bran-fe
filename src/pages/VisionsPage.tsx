import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { teamsApi, usersApi, visionsApi } from "@/lib/api"
import type { Team, User, Vision, VisionHorizon, VisionScope } from "@/types"
import { canManageVision } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UsersRound,
} from "lucide-react"

type VisionFormState = {
  title: string
  description: string
  horizon: VisionHorizon
  durationMonths: string
  startsAt: string
  scope: VisionScope
  teamIds: string[]
  userIds: string[]
  file: File | null
}

const emptyForm = (): VisionFormState => ({
  title: "",
  description: "",
  horizon: "SHORT_TERM",
  durationMonths: "6",
  startsAt: "",
  scope: "ALL",
  teamIds: [],
  userIds: [],
  file: null,
})

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function visionToForm(vision: Vision): VisionFormState {
  return {
    title: vision.title,
    description: vision.description ?? "",
    horizon: vision.horizon,
    durationMonths: String(vision.durationMonths),
    startsAt: vision.startsAt.slice(0, 16),
    scope: vision.scope,
    teamIds: vision.involvement.teams.map((t) => t.id),
    userIds: vision.involvement.users.map((u) => u.id),
    file: null,
  }
}

function buildVisionFormData(form: VisionFormState, includeFile: boolean) {
  const data = new FormData()
  if (includeFile && form.file) data.append("file", form.file)
  data.append("title", form.title.trim())
  if (form.description.trim()) data.append("description", form.description.trim())
  data.append("horizon", form.horizon)
  data.append("durationMonths", form.durationMonths)
  if (form.startsAt) data.append("startsAt", new Date(form.startsAt).toISOString())
  data.append("scope", form.scope)
  if (form.scope === "SPECIFIC") {
    data.append("teamIds", JSON.stringify(form.teamIds))
    data.append("userIds", JSON.stringify(form.userIds))
  }
  return data
}

export default function VisionsPage() {
  const { user } = useAuth()
  const canManage = canManageVision(user)

  const [visions, setVisions] = useState<Vision[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 12,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
  })
  const [horizonFilter, setHorizonFilter] = useState<string>("all")
  const [scopeFilter, setScopeFilter] = useState<string>("all")

  const [teams, setTeams] = useState<Team[]>([])
  const [users, setUsers] = useState<User[]>([])

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Vision | null>(null)
  const [form, setForm] = useState<VisionFormState>(emptyForm())
  const [saving, setSaving] = useState(false)

  const [detail, setDetail] = useState<Vision | null>(null)
  const [deleting, setDeleting] = useState<Vision | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    if (!canManage) return
    Promise.all([
      teamsApi.list().then(setTeams).catch(() => {}),
      usersApi.list({ page: 1, pageSize: 100, isActive: true }).then((r) => setUsers(r.items)).catch(() => {}),
    ])
  }, [canManage])

  const fetchVisions = useCallback(
    async (page = 1) => {
      setLoading(true)
      try {
        const params: Parameters<typeof visionsApi.list>[0] = { page, pageSize: 12 }
        if (horizonFilter !== "all") params.horizon = horizonFilter as VisionHorizon
        if (scopeFilter !== "all") params.scope = scopeFilter as VisionScope
        const res = await visionsApi.list(params)
        setVisions(res.items)
        setPagination(res.pagination)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load visions")
      } finally {
        setLoading(false)
      }
    },
    [horizonFilter, scopeFilter]
  )

  useEffect(() => {
    fetchVisions()
  }, [fetchVisions])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setFormOpen(true)
  }

  const openEdit = (vision: Vision) => {
    setEditing(vision)
    setForm(visionToForm(vision))
    setFormOpen(true)
  }

  const toggleTeam = (teamId: string) => {
    setForm((prev) => ({
      ...prev,
      teamIds: prev.teamIds.includes(teamId)
        ? prev.teamIds.filter((id) => id !== teamId)
        : [...prev.teamIds, teamId],
    }))
  }

  const toggleUser = (userId: string) => {
    setForm((prev) => ({
      ...prev,
      userIds: prev.userIds.includes(userId)
        ? prev.userIds.filter((id) => id !== userId)
        : [...prev.userIds, userId],
    }))
  }

  const validateForm = () => {
    if (!form.title.trim()) return "Title is required"
    const months = Number(form.durationMonths)
    if (!Number.isFinite(months) || months < 1 || months > 24) return "Duration must be 1–24 months"
    if (!editing && !form.file) return "Vision document is required"
    if (form.scope === "SPECIFIC" && form.teamIds.length === 0 && form.userIds.length === 0) {
      return "Select at least one team or user for specific scope"
    }
    return null
  }

  const handleSave = async () => {
    const error = validateForm()
    if (error) {
      toast.error(error)
      return
    }
    setSaving(true)
    try {
      const payload = buildVisionFormData(form, Boolean(form.file))
      if (editing) {
        await visionsApi.update(editing.id, payload)
        toast.success("Vision updated")
      } else {
        await visionsApi.create(payload)
        toast.success("Vision created")
      }
      setFormOpen(false)
      setEditing(null)
      fetchVisions(pagination.page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save vision")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await visionsApi.delete(deleting.id)
      toast.success("Vision deleted")
      setDeleting(null)
      fetchVisions(pagination.page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete vision")
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleDownload = async (vision: Vision) => {
    setDownloadingId(vision.id)
    try {
      const { blob, filename } = await visionsApi.downloadDocument(vision.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename || vision.document.originalFilename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download document")
    } finally {
      setDownloadingId(null)
    }
  }

  const horizonLabel = useMemo(
    () => ({
      SHORT_TERM: "Short term",
      LONG_TERM: "Long term",
    }),
    []
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-brand text-2xl tracking-wide text-accent">Vision</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Org direction documents that guide KPIs and AI focus recommendations.
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="gap-2 self-start">
            <Plus className="h-4 w-4" />
            New vision
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={horizonFilter} onValueChange={setHorizonFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Horizon" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All horizons</SelectItem>
            <SelectItem value="SHORT_TERM">Short term</SelectItem>
            <SelectItem value="LONG_TERM">Long term</SelectItem>
          </SelectContent>
        </Select>
        <Select value={scopeFilter} onValueChange={setScopeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Scope" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All scopes</SelectItem>
            <SelectItem value="ALL">Everyone</SelectItem>
            <SelectItem value="SPECIFIC">Specific</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : visions.length === 0 ? (
        <div className="rounded-xl border border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {canManage
              ? "No visions yet — upload your first direction document."
              : "No visions apply to you yet."}
          </p>
          {canManage ? (
            <Button onClick={openCreate} className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              Create first vision
            </Button>
          ) : (
            <p className="mx-auto mt-4 max-w-md text-xs text-muted-foreground">
              Only Admin or Chief of Staff can upload visions. You are signed in as{" "}
              <span className="font-medium text-foreground">{user?.role.name.replace(/_/g, " ")}</span>.
              Use Admin login or ask an admin to create one.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visions.map((vision) => (
            <article
              key={vision.id}
              className="flex flex-col rounded-xl border border-border bg-card/50 p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{horizonLabel[vision.horizon]}</Badge>
                    <Badge variant="secondary">{vision.scope === "ALL" ? "Everyone" : "Specific"}</Badge>
                  </div>
                  <h3 className="font-semibold leading-snug">{vision.title}</h3>
                  {vision.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{vision.description}</p>
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <p>{vision.durationMonths} months · ends {new Date(vision.endsAt).toLocaleDateString()}</p>
                <p className="inline-flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {vision.document.originalFilename} ({formatBytes(vision.document.fileSizeBytes)})
                </p>
                {vision.scope === "SPECIFIC" && (
                  <p className="inline-flex items-center gap-1">
                    <UsersRound className="h-3 w-3" />
                    {vision.involvement.teams.length} teams · {vision.involvement.users.length} people
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDetail(vision)}>
                  <Eye className="h-3.5 w-3.5" />
                  View
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={downloadingId === vision.id}
                  onClick={() => void handleDownload(vision)}
                >
                  {downloadingId === vision.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  Download
                </Button>
                {canManage && (
                  <>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openEdit(vision)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleting(vision)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{pagination.total} visions</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={pagination.page <= 1}
              onClick={() => fetchVisions(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={!pagination.hasNextPage}
              onClick={() => fetchVisions(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit vision" : "New vision"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Document {editing ? "(optional replacement)" : "*"}</Label>
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp"
                onChange={(e) =>
                  setForm((p) => ({ ...p, file: e.target.files?.[0] ?? null }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={form.title}
                maxLength={500}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={3}
                maxLength={8000}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Horizon *</Label>
                <Select
                  value={form.horizon}
                  onValueChange={(v) => setForm((p) => ({ ...p, horizon: v as VisionHorizon }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SHORT_TERM">Short term</SelectItem>
                    <SelectItem value="LONG_TERM">Long term</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duration (months) *</Label>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={form.durationMonths}
                  onChange={(e) => setForm((p) => ({ ...p, durationMonths: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Starts at</Label>
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Scope *</Label>
              <Select
                value={form.scope}
                onValueChange={(v) => setForm((p) => ({ ...p, scope: v as VisionScope }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Everyone in org</SelectItem>
                  <SelectItem value="SPECIFIC">Specific teams / people</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.scope === "SPECIFIC" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Teams</Label>
                  <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
                    {teams.map((team) => (
                      <label key={team.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.teamIds.includes(team.id)}
                          onChange={() => toggleTeam(team.id)}
                        />
                        {team.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>People</Label>
                  <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
                    {users.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.userIds.includes(u.id)}
                          onChange={() => toggleUser(u.id)}
                        />
                        {u.name}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              {detail.description && <p className="text-muted-foreground">{detail.description}</p>}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{horizonLabel[detail.horizon]}</Badge>
                <Badge variant="secondary">{detail.scope === "ALL" ? "Everyone" : "Specific"}</Badge>
              </div>
              <p className="text-muted-foreground">
                {detail.durationMonths} months · {new Date(detail.startsAt).toLocaleDateString()} →{" "}
                {new Date(detail.endsAt).toLocaleDateString()}
              </p>
              <p>
                Document: {detail.document.originalFilename} ({formatBytes(detail.document.fileSizeBytes)})
              </p>
              {detail.scope === "SPECIFIC" && (
                <div className="space-y-1">
                  {detail.involvement.teams.length > 0 && (
                    <p>Teams: {detail.involvement.teams.map((t) => t.name).join(", ")}</p>
                  )}
                  {detail.involvement.users.length > 0 && (
                    <p>People: {detail.involvement.users.map((u) => u.name).join(", ")}</p>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Created by {detail.createdBy.name} · {new Date(detail.createdAt).toLocaleDateString()}
              </p>
            </div>
          )}
          <DialogFooter>
            {detail && (
              <Button
                variant="outline"
                className="gap-2"
                disabled={downloadingId === detail.id}
                onClick={() => void handleDownload(detail)}
              >
                {downloadingId === detail.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download document
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete vision?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{deleting?.title}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleteLoading}>
              {deleteLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
