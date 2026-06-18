import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ChevronLeft, FolderKanban, Layers, Pencil, Trash2, UsersRound } from "lucide-react"
import { firstValidationError, validateRequiredSelection, validateRequiredText } from "@/lib/validation"
import { contentsApi, projectsApi, teamsApi } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import { hasRole } from "@/types"
import type { ContentStatus, ContentType } from "@/types"
import {
  CONTENT_STATUSES,
  CONTENT_STATUS_BADGE,
  CONTENT_TYPES,
  CONTENT_TYPE_BADGE,
  pretty,
} from "@/components/contents/contentMeta"
import { ContentCanvas } from "@/components/contents/ContentCanvas"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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

export default function ContentDetailPage() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const initialNodeId = searchParams.get("nodeId")

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    type: "PRODUCTION" as ContentType,
    status: "DRAFT" as ContentStatus,
    projectId: "",
    teamId: "",
  })

  const contentQuery = useQuery({
    queryKey: ["content", id],
    queryFn: () => contentsApi.getById(id),
    enabled: Boolean(id),
  })

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.list(),
    enabled: editOpen,
  })

  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: () => teamsApi.list(),
    enabled: editOpen,
  })

  useEffect(() => {
    if (!contentQuery.data) return
    setEditForm({
      title: contentQuery.data.title,
      description: contentQuery.data.description ?? "",
      type: contentQuery.data.type,
      status: contentQuery.data.status,
      projectId: contentQuery.data.projectId,
      teamId: contentQuery.data.teamId,
    })
  }, [contentQuery.data])

  const editProjects = projectsQuery.data ?? []
  const editTeams = teamsQuery.data ?? []
  const editSelectedProject = useMemo(
    () => editProjects.find((p) => p.id === editForm.projectId) ?? null,
    [editProjects, editForm.projectId]
  )
  const editEligibleTeams = useMemo(() => {
    if (!editSelectedProject?.verticalId) return editTeams
    return editTeams.filter((t) => t.verticalId === editSelectedProject.verticalId)
  }, [editTeams, editSelectedProject])

  useEffect(() => {
    if (!editOpen) return
    if (!editSelectedProject?.verticalId) return
    const team = editTeams.find((t) => t.id === editForm.teamId)
    if (team && team.verticalId !== editSelectedProject.verticalId) {
      setEditForm((p) => ({ ...p, teamId: "" }))
    }
  }, [editOpen, editSelectedProject, editTeams, editForm.teamId])

  const updateMutation = useMutation({
    mutationFn: () =>
      contentsApi.update(id, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        type: editForm.type,
        status: editForm.status,
        projectId: editForm.projectId,
        teamId: editForm.teamId,
      }),
    onSuccess: () => {
      toast.success("Content updated")
      queryClient.invalidateQueries({ queryKey: ["content", id] })
      queryClient.invalidateQueries({ queryKey: ["contents"] })
      setEditOpen(false)
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update content"),
  })

  const statusMutation = useMutation({
    mutationFn: (status: ContentStatus) => contentsApi.update(id, { status }),
    onSuccess: () => {
      toast.success("Status updated")
      queryClient.invalidateQueries({ queryKey: ["content", id] })
      queryClient.invalidateQueries({ queryKey: ["contents"] })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update status"),
  })

  const deleteMutation = useMutation({
    mutationFn: () => contentsApi.delete(id),
    onSuccess: () => {
      toast.success("Content deleted")
      queryClient.invalidateQueries({ queryKey: ["contents"] })
      navigate("/contents")
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete content"),
  })

  const content = contentQuery.data
  const canReview = useMemo(() => {
    if (!content || !user) return false
    if (content.createdBy?.id === user.id) return true
    // Until permissions are exposed on the user object, we use admin/manager
    // as a reasonable proxy; the server is still the source of truth (403).
    return hasRole(user, "admin", "manager")
  }, [content, user])

  if (!id) {
    return (
      <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
        Invalid content id.
      </div>
    )
  }

  if (contentQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40 rounded-md" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  if (contentQuery.isError || !content) {
    return (
      <div className="space-y-4">
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link to="/contents">
            <ChevronLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {(contentQuery.error as Error)?.message ?? "Content not found."}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link to="/contents">
            <ChevronLeft className="h-4 w-4" /> All content
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={CONTENT_TYPE_BADGE[content.type]}>{pretty(content.type)}</Badge>
            <Badge variant={CONTENT_STATUS_BADGE[content.status]}>{pretty(content.status)}</Badge>
            {content.createdBy?.name && (
              <span className="text-xs text-muted-foreground">
                created by {content.createdBy.name}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="gap-1.5">
              <Layers className="h-3 w-3" />
              {content.project?.vertical?.name ?? "—"}
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <FolderKanban className="h-3 w-3" />
              {content.project?.name ?? "—"}
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <UsersRound className="h-3 w-3" />
              {content.team?.name ?? "—"}
            </Badge>
            {content.project?.vertical?.ownerUserId && (
              <span className="text-muted-foreground">
                Rental approvals routed to the {content.project.vertical.name} head.
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h1 className="break-all font-brand text-2xl tracking-wide text-accent">{content.title}</h1>
              {content.description && (
                <p className="break-words max-w-3xl text-sm text-muted-foreground">{content.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={content.status}
                onValueChange={(v) => statusMutation.mutate(v as ContentStatus)}
                disabled={statusMutation.isPending}
              >
                <SelectTrigger className="h-8 w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {pretty(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Workflow ({content.nodes.length} {content.nodes.length === 1 ? "node" : "nodes"})
        </h2>
        <ContentCanvas content={content} canReview={canReview} initialOpenNodeId={initialNodeId} />
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit content</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={editForm.type}
                  onValueChange={(v) => setEditForm((p) => ({ ...p, type: v as ContentType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {pretty(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) => setEditForm((p) => ({ ...p, status: v as ContentStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {pretty(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Project *</Label>
                <Select
                  value={editForm.projectId}
                  onValueChange={(v) => setEditForm((p) => ({ ...p, projectId: v }))}
                  disabled={projectsQuery.isLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={projectsQuery.isLoading ? "Loading..." : "Select project"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {editProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Team *</Label>
                <Select
                  value={editForm.teamId}
                  onValueChange={(v) => setEditForm((p) => ({ ...p, teamId: v }))}
                  disabled={teamsQuery.isLoading || !editForm.projectId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !editForm.projectId
                          ? "Pick a project first"
                          : editEligibleTeams.length === 0
                            ? "No teams in this vertical"
                            : "Select team"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {editEligibleTeams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={updateMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const validationError = firstValidationError(
                  validateRequiredText(editForm.title, "Title"),
                  validateRequiredSelection(editForm.projectId, "Project"),
                  validateRequiredSelection(editForm.teamId, "Team")
                )
                if (validationError) {
                  toast.error(validationError)
                  return
                }
                updateMutation.mutate()
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete content</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <span className="font-medium text-foreground">{content.title}</span>? This will cascade to all
            nodes, team assignments, outputs, and resources. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
