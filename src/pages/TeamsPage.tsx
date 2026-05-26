import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { teamsApi, verticalsApi } from "@/lib/api"
import type { Team, Vertical } from "@/types"
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

export default function TeamsPage() {
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
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null)

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

  const visibleTeams = useMemo(() => {
    const teams = activeVertical?.teams ?? []
    if (!search) return teams
    const q = search.toLowerCase()
    return teams.filter((t) => t.name.toLowerCase().includes(q))
  }, [activeVertical, search])

  const openCreate = () => {
    setForm(emptyForm(activeVerticalId))
    setCreateOpen(true)
  }

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error("Team name is required")
      return
    }
    if (!form.verticalId) {
      toast.error("Vertical is required")
      return
    }
    setSaving(true)
    try {
      await teamsApi.create({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        verticalId: form.verticalId,
      })
      toast.success("Team created")
      setCreateOpen(false)
      setForm(emptyForm(activeVerticalId))
      setActiveVerticalId(form.verticalId)
      fetchVerticals()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create team")
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (team: Team) => {
    setEditingTeam(team)
    setForm({
      name: team.name,
      description: team.description ?? "",
      verticalId: team.verticalId ?? activeVerticalId,
    })
    setEditOpen(true)
  }

  const handleEdit = async () => {
    if (!editingTeam || !form.name.trim()) {
      toast.error("Team name is required")
      return
    }
    setSaving(true)
    try {
      await teamsApi.update(editingTeam.id, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        verticalId: form.verticalId || undefined,
      })
      toast.success("Team updated")
      setEditOpen(false)
      setEditingTeam(null)
      setForm(emptyForm(activeVerticalId))
      fetchVerticals()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update team")
    } finally {
      setSaving(false)
    }
  }

  const openDelete = (team: Team) => {
    setDeletingTeam(team)
    setDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingTeam) return
    setSaving(true)
    try {
      await teamsApi.delete(deletingTeam.id)
      toast.success("Team deleted")
      setDeleteOpen(false)
      setDeletingTeam(null)
      fetchVerticals()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete team")
    } finally {
      setSaving(false)
    }
  }

  const renderTeamGrid = (teams: Team[]) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {teams.map((team) => (
        <div
          key={team.id}
          role="button"
          tabIndex={0}
          onClick={() => navigate(`/teams/${team.id}`)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              navigate(`/teams/${team.id}`)
            }
          }}
          className="group flex cursor-pointer flex-col justify-between rounded-lg border border-border bg-background p-4 transition-colors hover:border-primary/50"
        >
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-foreground">{team.name}</h3>
              <Badge variant="outline" className="shrink-0 gap-1">
                <Users className="h-3 w-3" />
                {team.members?.length ?? 0}
              </Badge>
            </div>
            {team.description && (
              <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{team.description}</p>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={(event) => {
                event.stopPropagation()
                openEdit(team)
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
                openDelete(team)
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
          <h1 className="font-brand text-2xl tracking-wide text-accent">Teams</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage teams across your verticals
          </p>
        </div>
        <Button
          onClick={openCreate}
          disabled={!activeVerticalId}
          className="gap-2 self-start"
        >
          <Plus className="h-4 w-4" />
          Create Team
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search teams..."
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
                      {v._count?.teams ?? v.teams.length}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>

              {verticals.map((v) => {
                const teams = v.id === activeVerticalId ? visibleTeams : v.teams
                return (
                  <TabsContent key={v.id} value={v.id} className="mt-4">
                    {teams.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground">
                        {search
                          ? `No teams match your search in ${v.name}.`
                          : `No teams in ${v.name} yet.`}
                      </div>
                    ) : (
                      renderTeamGrid(teams)
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
            <DialogTitle>Create Team</DialogTitle>
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
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Engineering" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="What this team is responsible for..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Creating..." : "Create Team"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) { setEditingTeam(null); setForm(emptyForm(activeVerticalId)) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
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
      <Dialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); if (!open) setDeletingTeam(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Team</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-medium text-foreground">{deletingTeam?.name}</span>? This will remove all member associations. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>{saving ? "Deleting..." : "Delete Team"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
