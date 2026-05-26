import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { projectsApi, verticalsApi } from "@/lib/api"
import type { Project, Vertical } from "@/types"
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
import { Search, Plus, Pencil, Trash2, Users } from "lucide-react"

interface FormState {
  name: string
  description: string
  verticalId: string
}

const emptyForm = (verticalId = ""): FormState => ({ name: "", description: "", verticalId })

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [verticals, setVerticals] = useState<Vertical[]>([])
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

  const fetchVerticals = async () => {
    setLoading(true)
    try {
      const data = await verticalsApi.list()
      setVerticals(data)
      setActiveVerticalId((current) => {
        if (current && data.some((v) => v.id === current)) return current
        return data[0]?.id ?? ""
      })
    } catch {
      toast.error("Failed to load verticals")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchVerticals() }, [])

  const activeVertical = useMemo(
    () => verticals.find((v) => v.id === activeVerticalId) ?? null,
    [verticals, activeVerticalId]
  )

  const visibleProjects = useMemo(() => {
    const projects = activeVertical?.projects ?? []
    if (!search) return projects
    const q = search.toLowerCase()
    return projects.filter((p) => p.name.toLowerCase().includes(q))
  }, [activeVertical, search])

  const openCreate = () => {
    setForm(emptyForm(activeVerticalId))
    setCreateOpen(true)
  }

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error("Project name is required")
      return
    }
    if (!form.verticalId) {
      toast.error("Vertical is required")
      return
    }
    setSaving(true)
    try {
      await projectsApi.create({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        verticalId: form.verticalId,
      })
      toast.success("Project created")
      setCreateOpen(false)
      setForm(emptyForm(activeVerticalId))
      setActiveVerticalId(form.verticalId)
      fetchVerticals()
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
      verticalId: project.verticalId ?? activeVerticalId,
    })
    setEditOpen(true)
  }

  const handleEdit = async () => {
    if (!editingProject || !form.name.trim()) {
      toast.error("Project name is required")
      return
    }
    setSaving(true)
    try {
      await projectsApi.update(editingProject.id, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        verticalId: form.verticalId || undefined,
      })
      toast.success("Project updated")
      setEditOpen(false)
      setEditingProject(null)
      setForm(emptyForm(activeVerticalId))
      fetchVerticals()
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
      fetchVerticals()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete project")
    } finally {
      setSaving(false)
    }
  }

  const renderProjectGrid = (projects: Project[]) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
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
            {project.description && (
              <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{project.description}</p>
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-brand text-2xl tracking-wide text-accent">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage projects across your verticals
          </p>
        </div>
        <Button
          onClick={openCreate}
          disabled={!activeVerticalId}
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
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 w-full rounded-lg" />)}
              </div>
            </div>
          ) : verticals.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No verticals available yet.
            </div>
          ) : (
            <Tabs value={activeVerticalId} onValueChange={setActiveVerticalId}>
              <TabsList className="flex h-auto w-full flex-wrap gap-1">
                {verticals.map((v) => (
                  <TabsTrigger key={v.id} value={v.id} className="flex-1 gap-2">
                    <span>{v.name}</span>
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                      {v._count?.projects ?? v.projects.length}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>

              {verticals.map((v) => {
                const projects = v.id === activeVerticalId ? visibleProjects : v.projects
                return (
                  <TabsContent key={v.id} value={v.id} className="mt-4">
                    {projects.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground">
                        {search
                          ? `No projects match your search in ${v.name}.`
                          : `No projects in ${v.name} yet.`}
                      </div>
                    ) : (
                      renderProjectGrid(projects)
                    )}
                  </TabsContent>
                )
              })}
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setForm(emptyForm(activeVerticalId)) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Vertical *</Label>
              <Select
                value={form.verticalId}
                onValueChange={(value) => setForm((p) => ({ ...p, verticalId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a vertical" />
                </SelectTrigger>
                <SelectContent>
                  {verticals.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Brand Campaign Q3" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="What this project is about..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Creating..." : "Create Project"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) { setEditingProject(null); setForm(emptyForm(activeVerticalId)) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Vertical</Label>
              <Select
                value={form.verticalId}
                onValueChange={(value) => setForm((p) => ({ ...p, verticalId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a vertical" />
                </SelectTrigger>
                <SelectContent>
                  {verticals.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); if (!open) setDeletingProject(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-medium text-foreground">{deletingProject?.name}</span>? This will remove all member associations. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>{saving ? "Deleting..." : "Delete Project"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
