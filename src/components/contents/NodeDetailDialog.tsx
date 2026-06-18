import { useEffect, useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { validateRequiredText } from "@/lib/validation"
import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  Lock,
  Pencil,
  Trash2,
} from "lucide-react"
import { contentsApi } from "@/lib/api"
import type { Content, ContentNode, NodeKind, NodeStatus } from "@/types"
import {
  APPROVAL_BADGE,
  NODE_KINDS,
  NODE_STATUSES,
  NODE_STATUS_BADGE,
  pretty,
} from "@/components/contents/contentMeta"
import { OutputsSection } from "@/components/contents/OutputsSection"
import { TeamSection } from "@/components/contents/TeamSection"
import { ResourcesSection } from "@/components/contents/ResourcesSection"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  node: ContentNode
  content: Content
  index: number
  canReview: boolean
}

function toDateInput(value: string | null) {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString().slice(0, 10)
}

export function NodeDetailDialog({ open, onOpenChange, node, content, index, canReview }: Props) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    kind: node.kind as NodeKind,
    name: node.name,
    notes: node.notes ?? "",
    startsAt: toDateInput(node.startsAt),
    dueDate: toDateInput(node.dueDate),
  })

  useEffect(() => {
    setEditForm({
      kind: node.kind,
      name: node.name,
      notes: node.notes ?? "",
      startsAt: toDateInput(node.startsAt),
      dueDate: toDateInput(node.dueDate),
    })
  }, [node])

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["content", content.id] })

  const pendingRentals = useMemo(
    () =>
      node.resources.filter(
        (r) => r.sourceType === "RENTAL" && r.approvalState !== "APPROVED"
      ),
    [node.resources]
  )

  const statusMutation = useMutation({
    mutationFn: (status: NodeStatus) => contentsApi.setNodeStatus(node.id, status),
    onSuccess: () => {
      toast.success("Status updated")
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update status"),
  })

  const handleStatusChange = (next: NodeStatus) => {
    if (next === "COMPLETED" && pendingRentals.length > 0) {
      toast.error(
        `Cannot complete this node: ${pendingRentals.length} rental resource${
          pendingRentals.length === 1 ? "" : "s"
        } still awaiting approval`
      )
      return
    }
    statusMutation.mutate(next)
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      contentsApi.updateNode(node.id, {
        kind: editForm.kind,
        name: editForm.name.trim(),
        notes: editForm.notes.trim() || null,
        startsAt: editForm.startsAt ? new Date(editForm.startsAt).toISOString() : null,
        dueDate: editForm.dueDate ? new Date(editForm.dueDate).toISOString() : null,
      }),
    onSuccess: (updatedNode) => {
      toast.success("Node updated")
      // Optimistically patch the cached content so the canvas and dialog header
      // reflect the new kind/name immediately, without waiting for the refetch.
      queryClient.setQueryData(["content", content.id], (old: Content | undefined) => {
        if (!old) return old
        return {
          ...old,
          nodes: old.nodes.map((n) =>
            n.id === updatedNode.id ? { ...n, ...updatedNode } : n
          ),
        }
      })
      invalidate()
      setEditOpen(false)
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update node"),
  })

  const deleteMutation = useMutation({
    mutationFn: () => contentsApi.deleteNode(node.id),
    onSuccess: () => {
      toast.success("Node deleted")
      invalidate()
      setDeleteOpen(false)
      onOpenChange(false)
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete node"),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0">
        <DialogHeader className="border-b border-border p-5 pb-4 pr-12">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-sm font-semibold tabular-nums">
                {index + 1}
              </div>
              <div className="min-w-0 space-y-1.5">
                <DialogTitle className="break-all text-lg leading-tight">{node.name}</DialogTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{pretty(node.kind)}</Badge>
                  <Badge variant={NODE_STATUS_BADGE[node.status]}>{pretty(node.status)}</Badge>
                  {(node.startsAt || node.dueDate) && (
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {node.startsAt && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(node.startsAt).toLocaleDateString()}
                        </span>
                      )}
                      {node.dueDate && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Due {new Date(node.dueDate).toLocaleDateString()}
                        </span>
                      )}
                      {node.completedAt && (
                        <span className="inline-flex items-center gap-1 text-emerald-500">
                          <CheckCircle2 className="h-3 w-3" />
                          {new Date(node.completedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Select
                value={node.status}
                onValueChange={(v) => handleStatusChange(v as NodeStatus)}
                disabled={statusMutation.isPending}
              >
                <SelectTrigger className="h-8 w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NODE_STATUSES.map((s) => {
                    const blocked = s === "COMPLETED" && pendingRentals.length > 0
                    return (
                      <SelectItem key={s} value={s} disabled={blocked}>
                        {pretty(s)}
                        {blocked && " (pending rentals)"}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditOpen(true)} aria-label="Edit node">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
                aria-label="Delete node"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-0">

            {/* Notes */}
            {node.notes && (
              <div className="border-b border-border px-5 py-3 text-sm text-muted-foreground break-all whitespace-pre-wrap">
                {node.notes}
              </div>
            )}

            {/* Input */}
            <div className="px-5 py-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Lock className="h-4 w-4 text-muted-foreground" />
                Input
                <span className="text-xs font-normal text-muted-foreground">(read-only · from previous node)</span>
              </div>
              {node.input ? (
                <div className="rounded-md border border-border bg-background p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline">{pretty(node.input.fromNodeKind)}</Badge>
                    <span className="text-muted-foreground">from</span>
                    <span className="font-medium">{node.input.fromNodeName}</span>
                    <Badge variant={APPROVAL_BADGE[node.input.output.approvalState]}>
                      {pretty(node.input.output.approvalState)}
                    </Badge>
                    <Badge variant="outline">v{node.input.output.version}</Badge>
                  </div>
                  <div className="mt-2 break-all text-sm font-medium">{node.input.output.label}</div>
                  <a
                    href={node.input.output.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 break-all text-xs text-info hover:underline"
                  >
                    {node.input.output.url}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                  {node.input.output.notes && (
                    <p className="mt-2 text-xs text-muted-foreground">{node.input.output.notes}</p>
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                  {index === 0
                    ? "First node — no upstream input."
                    : "Waiting for the previous node to approve an output."}
                </div>
              )}
            </div>

            <Separator />

            <div className="grid gap-6 px-5 py-5 lg:grid-cols-2">
              <OutputsSection node={node} content={content} canReview={canReview} />
              <TeamSection node={node} contentId={content.id} />
            </div>

            <Separator />

            <div className="px-5 py-5">
              <ResourcesSection node={node} content={content} />
            </div>
          </div>
        </ScrollArea>
      </DialogContent>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit node</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Kind *</Label>
                <Select
                  value={editForm.kind}
                  onValueChange={(v) => setEditForm((p) => ({ ...p, kind: v as NodeKind }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NODE_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {pretty(k)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Starts</Label>
                <Input
                  type="date"
                  value={editForm.startsAt}
                  onChange={(e) => setEditForm((p) => ({ ...p, startsAt: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Due</Label>
                <Input
                  type="date"
                  value={editForm.dueDate}
                  onChange={(e) => setEditForm((p) => ({ ...p, dueDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={editForm.notes}
                onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={updateMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const validationError = validateRequiredText(editForm.name, "Name")
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
            <DialogTitle>Delete node</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <span className="font-medium text-foreground">{node.name}</span>? This will cascade to its team,
            outputs, and resources, and may strand later nodes that depended on its approved output.
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
              {deleteMutation.isPending ? "Deleting..." : "Delete node"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
