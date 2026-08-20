import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Boxes, Pencil, Plus, Search, Trash2, UserRound } from "lucide-react"
import { toast } from "sonner"

import { SearchableUserSelect } from "@/components/hierarchy/SearchableUserSelect"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/AuthContext"
import { podsApi, usersApi, verticalsApi } from "@/lib/api"
import { firstValidationError, validateRequiredSelection, validateRequiredText } from "@/lib/validation"
import { hasPermission, type Pod, type User, type Vertical } from "@/types"

interface FormState {
  name: string
  description: string
  verticalId: string
  headUserId: string
}

const emptyForm = (verticalId = ""): FormState => ({
  name: "",
  description: "",
  verticalId,
  headUserId: "",
})

export default function PodsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManage = hasPermission(user, "manage_pods")

  const [verticals, setVerticals] = useState<Vertical[]>([])
  const [pods, setPods] = useState<Pod[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeVerticalId, setActiveVerticalId] = useState("")

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [editingPod, setEditingPod] = useState<Pod | null>(null)
  const [deletingPod, setDeletingPod] = useState<Pod | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [verticalData, podData, userData] = await Promise.all([
        verticalsApi.list(),
        podsApi.list(),
        usersApi.listAll({ isActive: true }),
      ])
      setVerticals(verticalData)
      setPods(podData)
      setUsers(userData)
      setActiveVerticalId((current) => {
        if (current && verticalData.some((v) => v.id === current)) return current
        return verticalData[0]?.id ?? ""
      })
    } catch {
      toast.error("Failed to load pods")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const podsByVertical = useMemo(() => {
    const map = new Map<string, Pod[]>()
    for (const pod of pods) {
      const list = map.get(pod.verticalId) ?? []
      list.push(pod)
      map.set(pod.verticalId, list)
    }
    return map
  }, [pods])

  const visiblePods = useMemo(() => {
    const list = podsByVertical.get(activeVerticalId) ?? []
    if (!search) return list
    const q = search.toLowerCase()
    return list.filter(
      (pod) =>
        pod.name.toLowerCase().includes(q) ||
        pod.head?.name?.toLowerCase().includes(q) ||
        pod.description?.toLowerCase().includes(q)
    )
  }, [podsByVertical, activeVerticalId, search])

  const openCreate = () => {
    setForm(emptyForm(activeVerticalId))
    setCreateOpen(true)
  }

  const handleCreate = async () => {
    const validationError = firstValidationError(
      validateRequiredText(form.name, "Pod name"),
      validateRequiredSelection(form.verticalId, "Vertical"),
      validateRequiredSelection(form.headUserId, "Pod head")
    )
    if (validationError) {
      toast.error(validationError)
      return
    }
    setSaving(true)
    try {
      await podsApi.create({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        verticalId: form.verticalId,
        headUserId: form.headUserId,
      })
      toast.success("Pod created")
      setCreateOpen(false)
      setForm(emptyForm(activeVerticalId))
      setActiveVerticalId(form.verticalId)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create pod")
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (pod: Pod) => {
    setEditingPod(pod)
    setForm({
      name: pod.name,
      description: pod.description ?? "",
      verticalId: pod.verticalId,
      headUserId: pod.headUserId,
    })
    setEditOpen(true)
  }

  const handleEdit = async () => {
    if (!editingPod) return
    const validationError = firstValidationError(
      validateRequiredText(form.name, "Pod name"),
      validateRequiredSelection(form.headUserId, "Pod head")
    )
    if (validationError) {
      toast.error(validationError)
      return
    }
    setSaving(true)
    try {
      await podsApi.update(editingPod.id, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        verticalId: form.verticalId || undefined,
        headUserId: form.headUserId,
      })
      toast.success("Pod updated")
      setEditOpen(false)
      setEditingPod(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update pod")
    } finally {
      setSaving(false)
    }
  }

  const openDelete = (pod: Pod) => {
    setDeletingPod(pod)
    setDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingPod) return
    setSaving(true)
    try {
      await podsApi.deactivate(deletingPod.id)
      toast.success("Pod deactivated")
      setDeleteOpen(false)
      setDeletingPod(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deactivate pod")
    } finally {
      setSaving(false)
    }
  }

  const renderPodGrid = (items: Pod[]) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((pod) => (
        <div
          key={pod.id}
          role="button"
          tabIndex={0}
          onClick={() => navigate(`/pods/${pod.id}`)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              navigate(`/pods/${pod.id}`)
            }
          }}
          className="group flex cursor-pointer flex-col justify-between rounded-lg border border-border bg-background p-4 transition-colors hover:border-primary/50"
        >
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-foreground">{pod.name}</h3>
              <div className="flex shrink-0 gap-1">
                {!pod.isActive && <Badge variant="secondary">Inactive</Badge>}
                <Badge variant="outline" className="gap-1">
                  <Boxes className="h-3 w-3" />
                  {pod._count?.socialAccounts ?? pod.socialAccounts?.length ?? 0}
                </Badge>
              </div>
            </div>
            {pod.description && (
              <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{pod.description}</p>
            )}
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <UserRound className="h-3.5 w-3.5" />
              {pod.head?.name ?? "No head assigned"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {pod._count?.projects ?? pod.projects?.length ?? 0} projects
            </p>
          </div>
          {canManage && (
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={(event) => {
                  event.stopPropagation()
                  openEdit(pod)
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
                  openDelete(pod)
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Deactivate
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )

  const formFields = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Vertical *</Label>
        <Select
          value={form.verticalId}
          onValueChange={(value) => setForm((prev) => ({ ...prev, verticalId: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a vertical" />
          </SelectTrigger>
          <SelectContent>
            {verticals.map((vertical) => (
              <SelectItem key={vertical.id} value={vertical.id}>
                {vertical.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Name *</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Growth Pod"
        />
      </div>
      <div className="space-y-2">
        <Label>Pod head *</Label>
        <SearchableUserSelect
          users={users}
          value={form.headUserId || null}
          onChange={(userId) => setForm((prev) => ({ ...prev, headUserId: userId ?? "" }))}
          noneLabel="Select pod head"
          placeholder="Select pod head"
        />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="What this pod owns and creates..."
          rows={3}
        />
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-brand text-2xl tracking-wide text-accent">Pods</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Content units with a head, owned IPs, and inspiration accounts
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate} disabled={!activeVerticalId} className="gap-2 self-start">
            <Plus className="h-4 w-4" />
            Create Pod
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search pods..."
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
          ) : (
            <Tabs value={activeVerticalId} onValueChange={setActiveVerticalId}>
              <TabsList className="flex h-auto w-full flex-wrap gap-1">
                {verticals.map((vertical) => (
                  <TabsTrigger key={vertical.id} value={vertical.id} className="flex-1 gap-2">
                    <span>{vertical.name}</span>
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                      {podsByVertical.get(vertical.id)?.length ?? 0}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
              {verticals.map((vertical) => {
                const items = vertical.id === activeVerticalId ? visiblePods : podsByVertical.get(vertical.id) ?? []
                return (
                  <TabsContent key={vertical.id} value={vertical.id} className="mt-4">
                    {items.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground">
                        {search
                          ? `No pods match your search in ${vertical.name}.`
                          : `No pods in ${vertical.name} yet.`}
                      </div>
                    ) : (
                      renderPodGrid(items)
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
          if (!open) setForm(emptyForm(activeVerticalId))
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Pod</DialogTitle>
          </DialogHeader>
          {formFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create Pod"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setEditingPod(null)
            setForm(emptyForm(activeVerticalId))
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pod</DialogTitle>
          </DialogHeader>
          {formFields}
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
          if (!open) setDeletingPod(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Pod</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deactivate <span className="font-medium text-foreground">{deletingPod?.name}</span>? Existing
            projects stay linked; the pod will no longer appear as active.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? "Deactivating..." : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
