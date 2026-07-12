import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { adhocWorkApi, usersApi } from "@/lib/api"
import type { AdhocWorkEntry, User } from "@/types"
import { hasPermission, hasRole } from "@/types"
import {
  validateAdhocText,
  validateEffortHours,
} from "@/lib/validation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DateInput } from "@/components/ui/date-input"
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
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Trash2, X } from "lucide-react"

const emptyForm = { description: "", output: "", effortHours: "" }

function canManageEntry(entry: AdhocWorkEntry, userId: string | undefined, isManager: boolean) {
  return Boolean(userId && (entry.userId === userId || isManager))
}

function allFormErrors(form: typeof emptyForm, descriptionRequired: boolean): string[] {
  return [
    validateAdhocText(form.description, "Description", { required: descriptionRequired }),
    validateAdhocText(form.output, "Output"),
    validateEffortHours(form.effortHours),
  ].filter(Boolean) as string[]
}

export default function AdhocWorkPage() {
  const { user } = useAuth()
  const isManager = hasRole(user, "admin", "manager", "superadmin")
  const canCreate = hasPermission(user, "create_tasks")

  const [entries, setEntries] = useState<AdhocWorkEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
  })

  const [users, setUsers] = useState<User[]>([])
  const [filters, setFilters] = useState({ userId: "all", from: "", to: "" })
  const [appliedFilters, setAppliedFilters] = useState(filters)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(emptyForm)
  const [createErrors, setCreateErrors] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  const [editing, setEditing] = useState<AdhocWorkEntry | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editErrors, setEditErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const [deleting, setDeleting] = useState<AdhocWorkEntry | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    if (!isManager) return
    usersApi
      .list({ page: 1, pageSize: 100, isActive: true })
      .then((res) => setUsers(res.items))
      .catch(() => {})
  }, [isManager])

  const fetchEntries = useCallback(
    async (page = 1) => {
      setLoading(true)
      try {
        const params: Parameters<typeof adhocWorkApi.list>[0] = { page, pageSize: 20 }
        if (isManager && appliedFilters.userId !== "all") params.userId = appliedFilters.userId
        if (appliedFilters.from) params.from = new Date(appliedFilters.from).toISOString()
        if (appliedFilters.to) {
          const end = new Date(appliedFilters.to)
          end.setHours(23, 59, 59, 999)
          params.to = end.toISOString()
        }
        const res = await adhocWorkApi.list(params)
        setEntries(res.items)
        setPagination(res.pagination)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load entries")
      } finally {
        setLoading(false)
      }
    },
    [appliedFilters, isManager]
  )

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const openEdit = (entry: AdhocWorkEntry) => {
    setEditing(entry)
    setEditErrors([])
    setEditForm({
      description: entry.description,
      output: entry.output ?? "",
      effortHours: entry.effortHours != null ? String(entry.effortHours) : "",
    })
  }

  const handleCreate = async () => {
    const errors = allFormErrors(createForm, true)
    if (errors.length > 0) {
      setCreateErrors(errors)
      return
    }
    setCreateErrors([])
    setCreating(true)
    try {
      await adhocWorkApi.create({
        description: createForm.description.trim(),
        output: createForm.output.trim() || undefined,
        effortHours: createForm.effortHours.trim() ? Number(createForm.effortHours) : undefined,
      })
      toast.success("Entry logged")
      setCreateOpen(false)
      setCreateForm(emptyForm)
      fetchEntries(1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create entry")
    } finally {
      setCreating(false)
    }
  }

  const handleUpdate = async () => {
    if (!editing) return
    const errors = allFormErrors(editForm, true)
    if (errors.length > 0) {
      setEditErrors(errors)
      return
    }
    setEditErrors([])
    setSaving(true)
    try {
      const updated = await adhocWorkApi.update(editing.id, {
        description: editForm.description.trim(),
        output: editForm.output.trim() ? editForm.output.trim() : null,
        effortHours: editForm.effortHours.trim() ? Number(editForm.effortHours) : null,
      })
      setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
      toast.success("Entry updated")
      setEditing(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update entry")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await adhocWorkApi.delete(deleting.id)
      toast.success("Entry deleted")
      setDeleting(null)
      fetchEntries(pagination.page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete entry")
    } finally {
      setDeleteLoading(false)
    }
  }

  const clearFilters = () => {
    const reset = { userId: "all", from: "", to: "" }
    setFilters(reset)
    setAppliedFilters(reset)
  }

  return (
    <div className="mx-auto w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-brand text-2xl tracking-wide text-accent">Adhoc Work</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Log off-platform work — shoots, coordination, deliverables.
          </p>
        </div>
        {canCreate && (
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Log work
          </Button>
        )}
      </div>

      {isManager && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
          <div className="min-w-[140px] flex-1 space-y-1">
            <Label className="text-xs text-muted-foreground">Person</Label>
            <Select
              value={filters.userId}
              onValueChange={(v) => setFilters((p) => ({ ...p, userId: v }))}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">From</Label>
            <DateInput
              value={filters.from}
              onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">To</Label>
            <DateInput
              value={filters.to}
              onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))}
            />
          </div>
          <Button size="sm" variant="secondary" onClick={() => setAppliedFilters({ ...filters })}>
            Apply
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-foreground"
            onClick={clearFilters}
            disabled={filters.userId === "all" && !filters.from && !filters.to}
          >
            <X className="h-3.5 w-3.5" />
            Clear all
          </Button>
        </div>
      )}

      <div className="divide-y divide-border rounded-lg border border-border">
        {loading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No entries yet.</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="flex gap-3 overflow-hidden p-4">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="break-all text-sm leading-snug">{entry.description}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {isManager && <span>{entry.user.name}</span>}
                  <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                  {entry.effortHours != null && <span>{entry.effortHours}h</span>}
                  {entry.output && (
                    <span className="truncate max-w-[240px]" title={entry.output}>
                      {entry.output.startsWith("http") ? (
                        <a
                          href={entry.output}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Output
                        </a>
                      ) : (
                        entry.output
                      )}
                    </span>
                  )}
                </div>
              </div>
              {canManageEntry(entry, user?.id, isManager) && (
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(entry)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => setDeleting(entry)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{pagination.total} entries</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={pagination.page <= 1}
              onClick={() => fetchEntries(pagination.page - 1)}
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
              onClick={() => fetchEntries(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) { setCreateErrors([]); setCreateForm(emptyForm) } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Log adhoc work</DialogTitle>
          </DialogHeader>
          <AdhocForm form={createForm} onChange={setCreateForm} />
          {createErrors.length > 0 && <ValidationSummary errors={createErrors} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating} className="gap-2">
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) { setEditing(null); setEditErrors([]) } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit entry</DialogTitle>
          </DialogHeader>
          <AdhocForm form={editForm} onChange={setEditForm} />
          {editErrors.length > 0 && <ValidationSummary errors={editErrors} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Delete entry?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground line-clamp-3">{deleting?.description}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ValidationSummary({ errors }: { errors: string[] }) {
  return (
    <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2">
      <ul className="space-y-0.5 text-xs text-destructive">
        {errors.map((e, i) => (
          <li key={i}>• {e}</li>
        ))}
      </ul>
    </div>
  )
}

function AdhocForm({
  form,
  onChange,
}: {
  form: typeof emptyForm
  onChange: React.Dispatch<React.SetStateAction<typeof emptyForm>>
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>
          Description <span className="text-destructive">*</span>
        </Label>
        <Textarea
          rows={5}
          value={form.description}
          maxLength={8000}
          placeholder="What did you do?"
          className="resize-none"
          onChange={(e) => onChange((p) => ({ ...p, description: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Output (optional)</Label>
        <Input
          value={form.output}
          maxLength={8000}
          placeholder="Link, text, or numbers"
          onChange={(e) => onChange((p) => ({ ...p, output: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Effort hours (optional)</Label>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          max={999}
          step="0.5"
          className="max-w-[120px] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          value={form.effortHours}
          placeholder="3.5"
          onChange={(e) => onChange((p) => ({ ...p, effortHours: e.target.value }))}
        />
      </div>
    </div>
  )
}
