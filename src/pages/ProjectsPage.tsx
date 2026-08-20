import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { projectsApi, podsApi, verticalsApi } from "@/lib/api"
import type { Pod, Project, Vertical } from "@/types"
import { projectVerticalId } from "@/types"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { firstValidationError, validateRequiredSelection, validateRequiredText } from "@/lib/validation"
import { Search, Plus, Pencil, Trash2, Users } from "lucide-react"

interface FormState {
  name: string
  description: string
  podId: string
}

const emptyForm = (podId = ""): FormState => ({ name: "", description: "", podId })

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [verticals, setVerticals] = useState<Vertical[]>([])
  const [pods, setPods] = useState<Pod[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeVerticalId, setActiveVerticalId] = useState<string>("")

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<FormState>(emptyForm())
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [deletingProject, setDeletingProject] = useState<Project | null>(null)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [verticalData, podData, projectData] = await Promise.all([
        verticalsApi.list(),
        podsApi.list({ isActive: true }),
        projectsApi.list(),
      ])
      setVerticals(verticalData)
      setPods(podData)
      setProjects(projectData)
      setActiveVerticalId((current) => {
        if (current && verticalData.some((v) => v.id === current)) return current
        return verticalData[0]?.id ?? ""
      })
    } catch {
      toast.error("Failed to load projects")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchAll()
  }, [])

  const podsForActiveVertical = useMemo(
    () => pods.filter((pod) => pod.verticalId === activeVerticalId),
    [pods, activeVerticalId]
  )

  const projectsByVertical = useMemo(() => {
    const map = new Map<string, Project[]>()
    for (const project of projects) {
      const verticalId = projectVerticalId(project)
      if (!verticalId) continue
      const list = map.get(verticalId) ?? []
      list.push(project)
      map.set(verticalId, list)
    }
    return map
  }, [projects])

  const visibleProjects = useMemo(() => {
    const list = projectsByVertical.get(activeVerticalId) ?? []
    if (!search) return list
    const q = search.toLowerCase()
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.pod?.name?.toLowerCase().includes(q)
    )
  }, [projectsByVertical, activeVerticalId, search])

  const openCreate = () => {
    setForm(emptyForm(podsForActiveVertical[0]?.id ?? ""))
    setCreateOpen(true)
  }

  const handleCreate = async () => {
    const validationError = firstValidationError(
      validateRequiredText(form.name, "Project name"),
      validateRequiredSelection(form.podId, "Pod")
    )
    if (validationError) {
      toast.error(validationError)
      return
    }
    setSaving(true)
    try {
      await projectsApi.create({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        podId: form.podId,
      })
      toast.success("Project created")
      setCreateOpen(false)
      setForm(emptyForm())
      const selectedPod = pods.find((pod) => pod.id === form.podId)
      if (selectedPod) setActiveVerticalId(selectedPod.verticalId)
      await fetchAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create project")
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (project: Project) => {
    setEditingProject(project)
    setForm({
      name: project.name,
      description: project.description ?? "",
      podId: project.podId,
    })
    setEditOpen(true)
  }

  const handleEdit = async () => {
    if (!editingProject) return
    const validationError = firstValidationError(
      validateRequiredText(form.name, "Project name"),
      validateRequiredSelection(form.podId, "Pod")
    )
    if (validationError) {
      toast.error(validationError)
      return
    }
    setSaving(true)
    try {
      await projectsApi.update(editingProject.id, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        podId: form.podId,
      })
      toast.success("Project updated")
      setEditOpen(false)
      setEditingProject(null)
      setForm(emptyForm())
      await fetchAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update project")
    } finally {
      setSaving(false)
    }
  }

  const openDelete = (project: Project) => {
    setDeletingProject(project)
    setDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingProject) return
    setSaving(true)
    try {
      await projectsApi.delete(deletingProject.id)
      toast.success("Project deleted")
      setDeleteOpen(false)
      setDeletingProject(null)
      await fetchAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete project")
    } finally {
      setSaving(false)
    }
  }

  const renderProjectGrid = (items: Project[]) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((project) => (
        <div
          key={project.id}
          role="button"
          tabIndex={0}
          onClick={() => navigate(`/projects/${project.id}`)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              navigate(`/projects/${project.id}`)
            }
          }}
          className="group flex cursor-pointer flex-col justify-between rounded-lg border border-border bg-background p-4 transition-colors hover:border-primary/50"
        >
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-foreground">{project.name}</h3>
              <Badge variant="outline" className="shrink-0 gap-1">
                <Users className="h-3 w-3" />
                {project.members?.length ?? 0}
              </Badge>
            </div>
            {project.pod?.name && (
              <p className="mt-1 text-xs text-muted-foreground">Pod: {project.pod.name}</p>
            )}
            {project.description && (
              <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={(event) => {
                event.stopPropagation()
                openEdit(project)
              }}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-destructive hover:bg-destructive/10"
              onClick={(event) => {
                event.stopPropagation()
                openDelete(project)
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </div>
      ))}
    </div>
  )

  const podSelect = (
    <div className="space-y-2">
      <Label>Pod *</Label>
      <Select
        value={form.podId}
        onValueChange={(value) => setForm((prev) => ({ ...prev, podId: value }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a pod" />
        </SelectTrigger>
        <SelectContent>
          {pods.map((pod) => (
            <SelectItem key={pod.id} value={pod.id}>
              {pod.name}
              {pod.vertical?.name ? ` · ${pod.vertical.name}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-brand text-2xl tracking-wide text-accent">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage projects owned by pods across your verticals
          </p>
        </div>
        <Button
          onClick={openCreate}
          disabled={pods.length === 0}
          className="gap-2 self-start"
        >
          <Plus className="h-4 w-4" />
          Create Project
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-72 rounded-md" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-36 w-full rounded-lg" />
                ))}
              </div>
            </div>
          ) : verticals.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No verticals available yet.</div>
          ) : pods.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Create a pod first, then attach projects to it.
            </div>
          ) : (
            <Tabs value={activeVerticalId} onValueChange={setActiveVerticalId}>
              <TabsList className="flex h-auto w-full flex-wrap gap-1">
                {verticals.map((v) => (
                  <TabsTrigger key={v.id} value={v.id} className="flex-1 gap-2">
                    <span>{v.name}</span>
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                      {projectsByVertical.get(v.id)?.length ?? 0}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>

              {verticals.map((v) => {
                const items = v.id === activeVerticalId ? visibleProjects : projectsByVertical.get(v.id) ?? []
                return (
                  <TabsContent key={v.id} value={v.id} className="mt-4">
                    {items.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground">
                        {search
                          ? `No projects match your search in ${v.name}.`
                          : `No projects in ${v.name} yet.`}
                      </div>
                    ) : (
                      renderProjectGrid(items)
                    )}
                  </TabsContent>
                )
              })}
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) setForm(emptyForm())
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {podSelect}
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Brand Campaign Q3"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="What this project is about..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setEditingProject(null)
            setForm(emptyForm())
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {podSelect}
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) setDeletingProject(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-medium text-foreground">{deletingProject?.name}</span>? This will
            remove all member associations. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? "Deleting..." : "Delete Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
