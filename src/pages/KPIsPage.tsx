import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { kpisApi, usersApi } from "@/lib/api"
import type { KPI, User } from "@/types"
import { canManageVision } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
  Loader2,
  Pencil,
  Plus,
  Star,
  Target,
  Trash2,
  X,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type BatchRow = {
  title: string
  description: string
  isKey: boolean
  sortOrder: string
}

type EditFormState = {
  title: string
  description: string
  sortOrder: string
  isActive: boolean
  isKey: boolean
}

const emptyRow = (index = 0): BatchRow => ({
  title: "",
  description: "",
  isKey: false,
  sortOrder: String(index),
})

const emptyEditForm = (kpi: KPI): EditFormState => ({
  title: kpi.title,
  description: kpi.description ?? "",
  sortOrder: String(kpi.sortOrder),
  isActive: kpi.isActive,
  isKey: kpi.isKey,
})

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KPIsPage() {
  const { user } = useAuth()
  const canManage = canManageVision(user)

  const [kpis, setKpis] = useState<KPI[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
  })

  const [users, setUsers] = useState<User[]>([])
  const [userFilter, setUserFilter] = useState<string>("all")
  const [activeFilter, setActiveFilter] = useState<string>("all")
  const [keyFilter, setKeyFilter] = useState<string>("all")

  // Batch create state
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchUserId, setBatchUserId] = useState<string>("")
  const [batchRows, setBatchRows] = useState<BatchRow[]>([emptyRow()])
  const [batchSaving, setBatchSaving] = useState(false)

  // Edit state
  const [editing, setEditing] = useState<KPI | null>(null)
  const [editForm, setEditForm] = useState<EditFormState | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  // Delete state
  const [deleting, setDeleting] = useState<KPI | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    if (!canManage) return
    usersApi
      .list({ page: 1, pageSize: 100, isActive: true })
      .then((res) => {
        setUsers(res.items)
        if (res.items[0]) setBatchUserId(res.items[0].id)
      })
      .catch(() => {})
  }, [canManage])

  const fetchKpis = useCallback(
    async (page = 1) => {
      setLoading(true)
      try {
        const params: Parameters<typeof kpisApi.list>[0] = { page, pageSize: 20 }
        if (canManage && userFilter !== "all") params.userId = userFilter
        if (activeFilter === "active") params.isActive = true
        if (activeFilter === "inactive") params.isActive = false
        if (keyFilter === "key") params.isKey = true
        if (keyFilter === "nonkey") params.isKey = false
        const res = await kpisApi.list(params)
        setKpis(res.items)
        setPagination(res.pagination)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load KPIs")
      } finally {
        setLoading(false)
      }
    },
    [activeFilter, canManage, keyFilter, userFilter]
  )

  useEffect(() => {
    fetchKpis()
  }, [fetchKpis])

  // ── Batch create ────────────────────────────────────────────────────────────

  const openBatch = () => {
    setBatchRows([emptyRow()])
    setBatchUserId(
      userFilter !== "all" ? userFilter : (users[0]?.id ?? "")
    )
    setBatchOpen(true)
  }

  const updateRow = (i: number, patch: Partial<BatchRow>) => {
    setBatchRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  const addRow = () => {
    setBatchRows((prev) => [...prev, emptyRow(prev.length)])
  }

  const removeRow = (i: number) => {
    setBatchRows((prev) => prev.filter((_, idx) => idx !== i))
  }

  const handleBatchSave = async () => {
    if (!batchUserId) {
      toast.error("Select a person first")
      return
    }
    const valid = batchRows.filter((r) => r.title.trim())
    if (valid.length === 0) {
      toast.error("At least one title is required")
      return
    }
    setBatchSaving(true)
    try {
      await kpisApi.batch({
        userId: batchUserId,
        items: valid.map((r) => ({
          title: r.title.trim(),
          description: r.description.trim() || undefined,
          isKey: r.isKey,
          sortOrder: Number(r.sortOrder) || 0,
          isActive: true,
        })),
      })
      toast.success(`${valid.length} KPI${valid.length > 1 ? "s" : ""} created`)
      setBatchOpen(false)
      fetchKpis(pagination.page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create KPIs")
    } finally {
      setBatchSaving(false)
    }
  }

  // ── Edit ────────────────────────────────────────────────────────────────────

  const openEdit = (kpi: KPI) => {
    setEditing(kpi)
    setEditForm(emptyEditForm(kpi))
  }

  const handleEditSave = async () => {
    if (!editing || !editForm) return
    if (!editForm.title.trim()) {
      toast.error("Title is required")
      return
    }
    setEditSaving(true)
    try {
      await kpisApi.update(editing.id, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || undefined,
        sortOrder: Number(editForm.sortOrder) || 0,
        isActive: editForm.isActive,
        isKey: editForm.isKey,
      })
      toast.success("KPI updated")
      setEditing(null)
      setEditForm(null)
      fetchKpis(pagination.page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update KPI")
    } finally {
      setEditSaving(false)
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await kpisApi.delete(deleting.id)
      toast.success("KPI deleted")
      setDeleting(null)
      fetchKpis(pagination.page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete KPI")
    } finally {
      setDeleteLoading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-brand text-2xl tracking-wide text-accent">KPIs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Per-person expected outcomes used alongside vision docs for AI guidance.
          </p>
        </div>
        {canManage && (
          <Button onClick={openBatch} className="gap-2 self-start">
            <Plus className="h-4 w-4" />
            Add KPIs
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {canManage && (
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Person" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All people</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={keyFilter} onValueChange={setKeyFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All KPIs</SelectItem>
            <SelectItem value="key">Key only</SelectItem>
            <SelectItem value="nonkey">Non-key</SelectItem>
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="w-full sm:w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : kpis.length === 0 ? (
        <div className="rounded-xl border border-border py-16 text-center text-sm text-muted-foreground">
          {canManage ? "No KPIs yet — add expected outcomes for your team." : "No KPIs yet."}
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {kpis.map((kpi) => (
            <div key={kpi.id} className="flex gap-4 p-4">
              <div
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  kpi.isKey
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    : "bg-primary/10 text-accent"
                }`}
              >
                {kpi.isKey ? <Star className="h-4 w-4 fill-current" /> : <Target className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{kpi.title}</p>
                  {kpi.isKey && (
                    <Badge variant="warning" className="gap-1 py-0 text-[10px]">
                      Key
                    </Badge>
                  )}
                  <Badge variant={kpi.isActive ? "success" : "secondary"} className="py-0 text-[10px]">
                    {kpi.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                {kpi.description && (
                  <p className="text-sm text-muted-foreground">{kpi.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {canManage ? `${kpi.user.name ?? kpi.user.email} · ` : ""}
                  Order {kpi.sortOrder}
                </p>
              </div>
              {canManage && (
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(kpi)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => setDeleting(kpi)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{pagination.total} KPIs</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={pagination.page <= 1}
              onClick={() => fetchKpis(pagination.page - 1)}
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
              onClick={() => fetchKpis(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Batch create dialog ───────────────────────────────────────────── */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add KPIs</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Person */}
            <div className="space-y-1.5">
              <Label>Person *</Label>
              <Select value={batchUserId} onValueChange={setBatchUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select person" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Rows */}
            <div className="space-y-3">
              {batchRows.map((row, i) => (
                <div key={i} className="rounded-lg border border-border p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">#{i + 1}</span>
                    <div className="flex items-center gap-3">
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                        <Switch
                          checked={row.isKey}
                          onCheckedChange={(v) => updateRow(i, { isKey: v })}
                          className="scale-75"
                        />
                        <Star
                          className={`h-3.5 w-3.5 ${row.isKey ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`}
                        />
                        Key KPI
                      </label>
                      {batchRows.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => removeRow(i)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <Input
                    placeholder="Title *"
                    value={row.title}
                    onChange={(e) => updateRow(i, { title: e.target.value })}
                  />
                  <Textarea
                    placeholder="Description (optional)"
                    rows={2}
                    value={row.description}
                    onChange={(e) => updateRow(i, { description: e.target.value })}
                  />
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 w-full"
              onClick={addRow}
              disabled={batchRows.length >= 50}
            >
              <Plus className="h-3.5 w-3.5" />
              Add another KPI
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(false)} disabled={batchSaving}>
              Cancel
            </Button>
            <Button onClick={() => void handleBatchSave()} disabled={batchSaving} className="gap-2">
              {batchSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save {batchRows.filter((r) => r.title.trim()).length > 0
                ? `${batchRows.filter((r) => r.title.trim()).length} KPI${batchRows.filter((r) => r.title.trim()).length > 1 ? "s" : ""}`
                : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ───────────────────────────────────────────────────── */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) { setEditing(null); setEditForm(null) } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit KPI</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input
                  value={editForm.title}
                  onChange={(e) => setEditForm((p) => p && { ...p, title: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm((p) => p && { ...p, description: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={editForm.sortOrder}
                  onChange={(e) => setEditForm((p) => p && { ...p, sortOrder: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <Label className="flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5" />
                    Key KPI
                  </Label>
                  <Switch
                    checked={editForm.isKey}
                    onCheckedChange={(v) => setEditForm((p) => p && { ...p, isKey: v })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <Label>Active</Label>
                  <Switch
                    checked={editForm.isActive}
                    onCheckedChange={(v) => setEditForm((p) => p && { ...p, isActive: v })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setEditForm(null) }} disabled={editSaving}>
              Cancel
            </Button>
            <Button onClick={() => void handleEditSave()} disabled={editSaving} className="gap-2">
              {editSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ────────────────────────────────────────────────── */}
      <Dialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete KPI?</DialogTitle>
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
