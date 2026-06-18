import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/contexts/AuthContext"
import { inventoryApi, teamsApi } from "@/lib/api"
import type { InventoryItem, InventoryStatus, ReservationStatus, Team } from "@/types"
import { hasPermission, hasRole } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from "lucide-react"

// ─── Status helpers ──────────────────────────────────────────────────────────

const ITEM_STATUS_LABELS: Record<InventoryStatus, string> = {
  AVAILABLE: "Available",
  IN_USE: "In Use",
  MAINTENANCE: "Maintenance",
  RETIRED: "Retired",
}

const ITEM_STATUS_CLASSES: Record<InventoryStatus, string> = {
  AVAILABLE: "border-emerald-600/40 bg-emerald-500/10 text-emerald-400",
  IN_USE: "border-blue-600/40 bg-blue-500/10 text-blue-400",
  MAINTENANCE: "border-amber-600/40 bg-amber-500/10 text-amber-400",
  RETIRED: "border-zinc-600/40 bg-zinc-500/10 text-zinc-400",
}

const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  ACTIVE: "Active",
  OVERDUE: "Overdue",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
}

const RESERVATION_STATUS_CLASSES: Record<ReservationStatus, string> = {
  ACTIVE: "border-blue-600/40 bg-blue-500/10 text-blue-400",
  OVERDUE: "border-red-600/40 bg-red-500/10 text-red-400",
  RETURNED: "border-emerald-600/40 bg-emerald-500/10 text-emerald-400",
  CANCELLED: "border-zinc-600/40 bg-zinc-500/10 text-zinc-400",
}

const CATEGORIES = ["Camera", "Audio", "Lighting", "Lens", "Grip", "Stabilizer", "Monitor", "Storage", "Power", "Other"]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

// ─── ItemStatusBadge ─────────────────────────────────────────────────────────

function ItemStatusBadge({ status }: { status: InventoryStatus }) {
  return (
    <Badge variant="outline" className={`text-[11px] ${ITEM_STATUS_CLASSES[status]}`}>
      {ITEM_STATUS_LABELS[status]}
    </Badge>
  )
}

function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  return (
    <Badge variant="outline" className={`text-[11px] ${RESERVATION_STATUS_CLASSES[status]}`}>
      {RESERVATION_STATUS_LABELS[status]}
    </Badge>
  )
}

// ─── ItemFormDialog ───────────────────────────────────────────────────────────

interface ItemFormState {
  name: string
  description: string
  category: string
  serialNumber: string
  status: InventoryStatus
  isActive: boolean
  teamIds: string[]
  primaryTeamId: string
}

const EMPTY_FORM: ItemFormState = {
  name: "",
  description: "",
  category: "",
  serialNumber: "",
  status: "AVAILABLE",
  isActive: true,
  teamIds: [],
  primaryTeamId: "",
}

interface ItemFormDialogProps {
  open: boolean
  onClose: () => void
  editing?: InventoryItem | null
  teams: Team[]
}

function ItemFormDialog({ open, onClose, editing, teams }: ItemFormDialogProps) {
  const qc = useQueryClient()
  const [form, setForm] = useState<ItemFormState>(() =>
    editing
      ? {
          name: editing.name,
          description: editing.description ?? "",
          category: editing.category ?? "",
          serialNumber: editing.serialNumber ?? "",
          status: editing.status,
          isActive: editing.isActive,
          teamIds: editing.teams.map((t) => t.teamId),
          primaryTeamId: editing.teams.find((t) => t.isPrimary)?.teamId ?? "",
        }
      : EMPTY_FORM
  )

  const [error, setError] = useState("")

  const createMutation = useMutation({
    mutationFn: () =>
      inventoryApi.create({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        category: form.category.trim() || undefined,
        serialNumber: form.serialNumber.trim() || undefined,
        status: form.status,
        isActive: form.isActive,
        teamIds: form.teamIds.length ? form.teamIds : undefined,
        primaryTeamId: form.primaryTeamId || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] })
      toast.success("Equipment added")
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      inventoryApi.update(editing!.id, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        serialNumber: form.serialNumber.trim() || null,
        status: form.status,
        isActive: form.isActive,
        teamIds: form.teamIds,
        primaryTeamId: form.primaryTeamId || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] })
      toast.success("Equipment updated")
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!form.name.trim()) { setError("Name is required"); return }
    if (form.primaryTeamId && !form.teamIds.includes(form.primaryTeamId)) {
      setError("Primary team must be in the selected teams")
      return
    }
    editing ? updateMutation.mutate() : createMutation.mutate()
  }

  function toggleTeam(id: string) {
    setForm((f) => {
      const next = f.teamIds.includes(id)
        ? f.teamIds.filter((t) => t !== id)
        : [...f.teamIds, id]
      return {
        ...f,
        teamIds: next,
        primaryTeamId: f.primaryTeamId === id && !next.includes(id) ? "" : f.primaryTeamId,
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Equipment" : "Add Equipment"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Sony FX3"
                maxLength={500}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v === "_none" ? "" : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as InventoryStatus }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["AVAILABLE", "IN_USE", "MAINTENANCE", "RETIRED"] as InventoryStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{ITEM_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Serial Number</Label>
              <Input
                value={form.serialNumber}
                onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))}
                placeholder="SN-12345"
                maxLength={200}
              />
            </div>
            <div className="flex items-end gap-2 pb-0.5">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                <span className="text-sm">Active</span>
              </label>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
                rows={2}
                maxLength={8000}
              />
            </div>
          </div>

          {teams.length > 0 && (
            <div className="space-y-2">
              <Label>Team Ownership</Label>
              <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
                {teams.map((team) => {
                  const selected = form.teamIds.includes(team.id)
                  return (
                    <div key={team.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`team-${team.id}`}
                        className="h-3.5 w-3.5 rounded border-border"
                        checked={selected}
                        onChange={() => toggleTeam(team.id)}
                      />
                      <label htmlFor={`team-${team.id}`} className="flex-1 cursor-pointer text-sm">
                        {team.name}
                      </label>
                      {selected && (
                        <label className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground">
                          <input
                            type="radio"
                            name="primaryTeam"
                            value={team.id}
                            checked={form.primaryTeamId === team.id}
                            onChange={() => setForm((f) => ({ ...f, primaryTeamId: team.id }))}
                            className="h-3 w-3"
                          />
                          Primary
                        </label>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save Changes" : "Add Equipment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── ReturnDialog ─────────────────────────────────────────────────────────────

interface ReturnDialogProps {
  open: boolean
  onClose: () => void
  reservationId: string
  itemName: string
}

function ReturnDialog({ open, onClose, reservationId, itemName }: ReturnDialogProps) {
  const qc = useQueryClient()
  const [notes, setNotes] = useState("")

  const mutation = useMutation({
    mutationFn: () => inventoryApi.returnItem(reservationId, { notes: notes.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] })
      qc.invalidateQueries({ queryKey: ["inventory-reservations"] })
      toast.success(`${itemName} marked as returned`)
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark Returned</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Mark <span className="font-medium text-foreground">{itemName}</span> as returned.
          </p>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Returned in good condition"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Mark Returned
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Catalog Tab ─────────────────────────────────────────────────────────────

interface CatalogTabProps {
  canManage: boolean
  teams: Team[]
}

function CatalogTab({ canManage, teams }: CatalogTabProps) {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | "">("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [search, setSearch] = useState("")
  const [showInactive, setShowInactive] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<InventoryItem | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["inventory", page, statusFilter, categoryFilter, showInactive],
    queryFn: () =>
      inventoryApi.list({
        page,
        pageSize: 20,
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        isActive: showInactive ? undefined : true,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] })
      toast.success("Equipment removed")
      setDeleteConfirm(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const items = data?.items ?? []
  const filtered = search.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items
  const pagination = data?.pagination

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="h-8 w-48 text-sm"
          placeholder="Search equipment…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v === "_all" ? "" : v); setPage(1) }}>
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "_all" ? "" : v as InventoryStatus); setPage(1) }}>
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All statuses</SelectItem>
            {(["AVAILABLE", "IN_USE", "MAINTENANCE", "RETIRED"] as InventoryStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{ITEM_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-border"
            checked={showInactive}
            onChange={(e) => { setShowInactive(e.target.checked); setPage(1) }}
          />
          Show inactive
        </label>
        {canManage && (
          <Button size="sm" className="ml-auto h-8" onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Equipment
          </Button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <Package className="h-8 w-8 opacity-30" />
          <p className="text-sm">No equipment found</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background p-3.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{item.name}</span>
                  <ItemStatusBadge status={item.status} />
                  {!item.isActive && (
                    <Badge variant="outline" className="text-[11px] text-muted-foreground">Inactive</Badge>
                  )}
                  {item.category && (
                    <Badge variant="outline" className="text-[11px]">{item.category}</Badge>
                  )}
                </div>
                {item.serialNumber && (
                  <p className="mt-0.5 text-xs text-muted-foreground">S/N: {item.serialNumber}</p>
                )}
                {item.description && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-foreground/60">{item.description}</p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/60">
                  {item.teams.length > 0 && (
                    <span>
                      {item.teams
                        .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
                        .map((t) => `${t.team.name}${t.isPrimary ? " (primary)" : ""}`)
                        .join(", ")}
                    </span>
                  )}
                  {item.activeReservations.length > 0 && (
                    <span className="text-blue-400">
                      On shoot: {item.activeReservations[0].node.content.title}
                      {" — "}due {formatDate(item.activeReservations[0].dueBackAt)}
                    </span>
                  )}
                </div>
              </div>
              {canManage && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    title="Edit"
                    onClick={() => { setEditing(item); setFormOpen(true) }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    title="Delete"
                    onClick={() => setDeleteConfirm(item)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-1 text-sm text-muted-foreground">
          <span>
            {pagination.total} items · page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={!pagination.hasNextPage} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create / Edit dialog */}
      {formOpen && (
        <ItemFormDialog
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditing(null) }}
          editing={editing}
          teams={teams}
        />
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={(v) => { if (!v) setDeleteConfirm(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Equipment</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <span className="font-medium text-foreground">{deleteConfirm?.name}</span> from the catalog?
            {(deleteConfirm?.activeReservations.length ?? 0) > 0 && (
              <span className="mt-1 block text-amber-500">
                <TriangleAlert className="mr-1 inline h-3.5 w-3.5" />
                This item has active reservations. The server will reject deletion.
              </span>
            )}
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)} disabled={deleteMutation.isPending}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Reservations Tab ─────────────────────────────────────────────────────────

interface ReservationsTabProps {
  canReturn: boolean
}

function ReservationsTab({ canReturn }: ReservationsTabProps) {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | "">("")
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [returnTarget, setReturnTarget] = useState<{ id: string; itemName: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["inventory-reservations", page, statusFilter, overdueOnly],
    queryFn: () =>
      inventoryApi.listReservations({
        page,
        pageSize: 20,
        status: statusFilter || undefined,
        overdueOnly: overdueOnly || undefined,
      }),
  })

  const reservations = data?.items ?? []
  const pagination = data?.pagination

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "_all" ? "" : v as ReservationStatus); setPage(1) }}>
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All statuses</SelectItem>
            {(["ACTIVE", "OVERDUE", "RETURNED", "CANCELLED"] as ReservationStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{RESERVATION_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-border"
            checked={overdueOnly}
            onChange={(e) => { setOverdueOnly(e.target.checked); setStatusFilter(""); setPage(1) }}
          />
          Overdue only
        </label>
        {overdueOnly && (
          <Badge variant="outline" className="border-red-600/40 bg-red-500/10 text-red-400">
            <TriangleAlert className="mr-1 h-3 w-3" /> Showing overdue
          </Badge>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : reservations.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <RefreshCw className="h-8 w-8 opacity-30" />
          <p className="text-sm">No reservations found</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {reservations.map((res) => (
            <li
              key={res.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background p-3.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{res.item.name}</span>
                  <ReservationStatusBadge status={res.status} />
                  {res.item.category && (
                    <Badge variant="outline" className="text-[11px]">{res.item.category}</Badge>
                  )}
                </div>
                {res.item.serialNumber && (
                  <p className="mt-0.5 text-xs text-muted-foreground">S/N: {res.item.serialNumber}</p>
                )}
                <div className="mt-1 text-xs text-foreground/60">
                  <span>
                    Shoot: <span className="text-foreground/80">{res.node.content.title}</span>
                    {" — "}{res.node.name}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-foreground/50">
                  <span>Reserved: {formatDate(res.reservedFrom)}</span>
                  <span>Due back: {formatDate(res.dueBackAt)}</span>
                  {res.returnedAt && <span>Returned: {formatDate(res.returnedAt)}</span>}
                </div>
                {res.notes && (
                  <p className="mt-0.5 text-xs italic text-foreground/50">{res.notes}</p>
                )}
                {res.createdBy && (
                  <p className="mt-0.5 text-xs text-foreground/40">
                    Booked by {res.createdBy.name}
                  </p>
                )}
              </div>
              {canReturn && (res.status === "ACTIVE" || res.status === "OVERDUE") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 gap-1.5 text-xs"
                  onClick={() => setReturnTarget({ id: res.id, itemName: res.item.name })}
                >
                  <RefreshCw className="h-3 w-3" /> Return
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-1 text-sm text-muted-foreground">
          <span>
            {pagination.total} reservations · page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={!pagination.hasNextPage} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {returnTarget && (
        <ReturnDialog
          open={!!returnTarget}
          onClose={() => setReturnTarget(null)}
          reservationId={returnTarget.id}
          itemName={returnTarget.itemName}
        />
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const { user } = useAuth()
  const canManage = hasPermission(user, "manage_inventory") || hasRole(user, "admin") || hasRole(user, "manager")
  const canReturn = canManage || hasPermission(user, "manage_content")

  const { data: teamsData } = useQuery({
    queryKey: ["teams"],
    queryFn: () => teamsApi.list(),
    enabled: canManage,
  })
  const teams: Team[] = teamsData ?? []

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Camera className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold">Inventory</h1>
          <p className="text-sm text-muted-foreground">Equipment catalog — cameras, mics, lights, and gear</p>
        </div>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList className="h-8">
          <TabsTrigger value="catalog" className="text-xs">Catalog</TabsTrigger>
          <TabsTrigger value="reservations" className="text-xs">Reservations</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-4">
          <CatalogTab canManage={canManage} teams={teams} />
        </TabsContent>

        <TabsContent value="reservations" className="mt-4">
          <ReservationsTab canReturn={canReturn} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
