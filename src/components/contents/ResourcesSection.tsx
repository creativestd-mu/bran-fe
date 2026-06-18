import { useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Building2,
  Check,
  CircleSlash,
  Coins,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Truck,
  X,
} from "lucide-react"
import { contentsApi } from "@/lib/api"
import {
  firstValidationError,
  validateCurrency,
  validateMoneyAmount,
  validatePositiveInteger,
  validateRequiredText,
} from "@/lib/validation"
import { useAuth } from "@/contexts/AuthContext"
import { hasPermission } from "@/types"
import type {
  Content,
  ContentNode,
  ContentNodeResource,
  ResourceApprovalState,
  ResourceSourceType,
} from "@/types"
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

interface Props {
  node: ContentNode
  content: Content
}

interface FormState {
  name: string
  sourceType: ResourceSourceType
  cost: string
  quantity: string
  currency: string
  notes: string
}

const empty: FormState = {
  name: "",
  sourceType: "IN_HOUSE",
  cost: "",
  quantity: "1",
  currency: "INR",
  notes: "",
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

function formatDate(iso: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString()
}

const APPROVAL_BADGE_VARIANT: Record<ResourceApprovalState, "warning" | "success" | "destructive"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
}

export function ResourcesSection({ node, content }: Props) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<ContentNodeResource | null>(null)
  const [form, setForm] = useState<FormState>(empty)
  const [reviewTarget, setReviewTarget] = useState<{
    resource: ContentNodeResource
    decision: ResourceApprovalState
  } | null>(null)
  const [reviewNote, setReviewNote] = useState("")

  const verticalOwnerId = content.project?.vertical?.ownerUserId ?? null
  const verticalName = content.project?.vertical?.name ?? "the vertical head"

  const canReviewRentals = useMemo(() => {
    if (!user) return false
    if (verticalOwnerId && user.id === verticalOwnerId) return true
    return hasPermission(user, "approve_rental_resources")
  }, [user, verticalOwnerId])

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["content", content.id] })

  // Only RENTAL items have monetary values; IN_HOUSE rows are pure line items.
  // Pending / rejected rentals still represent committed asks, so we surface
  // their value in the subtotal so finance can see the full request.
  const totalsByCurrency = useMemo(() => {
    const acc = new Map<string, number>()
    for (const r of node.resources) {
      if (r.sourceType !== "RENTAL" || !r.cost || !r.currency) continue
      const cost = Number(r.cost) || 0
      const qty = Number(r.quantity) || 0
      acc.set(r.currency, (acc.get(r.currency) ?? 0) + cost * qty)
    }
    return Array.from(acc.entries())
  }, [node.resources])

  const counts = useMemo(() => {
    let inHouse = 0
    let rental = 0
    let pending = 0
    for (const r of node.resources) {
      if (r.sourceType === "RENTAL") {
        rental += 1
        if (r.approvalState === "PENDING") pending += 1
      } else inHouse += 1
    }
    return { inHouse, rental, pending }
  }, [node.resources])

  const openCreate = () => {
    setEditing(null)
    setForm(empty)
    setCreateOpen(true)
  }

  const openEdit = (resource: ContentNodeResource) => {
    setEditing(resource)
    setForm({
      name: resource.name,
      sourceType: resource.sourceType,
      cost: resource.cost ?? "",
      quantity: String(resource.quantity),
      currency: resource.currency ?? "INR",
      notes: resource.notes ?? "",
    })
    setCreateOpen(true)
  }

  const [addAnotherPending, setAddAnotherPending] = useState(false)

  const saveMutation = useMutation({
    mutationFn: () => {
      const quantity = Number(form.quantity || "1")
      const baseName = form.name.trim()
      const notes = form.notes.trim() || undefined

      if (form.sourceType === "RENTAL") {
        const cost = Number(form.cost)
        const currency = (form.currency.trim() || "INR").toUpperCase()
        if (editing) {
          return contentsApi.updateResource(editing.id, {
            name: baseName,
            sourceType: "RENTAL",
            cost,
            quantity,
            currency,
            notes: notes ?? null,
          })
        }
        return contentsApi.createResource(node.id, {
          name: baseName,
          sourceType: "RENTAL",
          cost,
          quantity,
          currency,
          notes,
        })
      }

      // IN_HOUSE: server forces cost/currency to null, but we send null explicitly
      // on update so transitioning RENTAL -> IN_HOUSE is unambiguous.
      if (editing) {
        return contentsApi.updateResource(editing.id, {
          name: baseName,
          sourceType: "IN_HOUSE",
          cost: null,
          currency: null,
          quantity,
          notes: notes ?? null,
        })
      }
      return contentsApi.createResource(node.id, {
        name: baseName,
        sourceType: "IN_HOUSE",
        quantity,
        notes,
      })
    },
    onSuccess: (resource) => {
      const isRentalRequest =
        !editing && resource.sourceType === "RENTAL" && resource.approvalState === "PENDING"
      toast.success(
        editing
          ? "Resource updated"
          : isRentalRequest
            ? `Sent to ${verticalName} for approval`
            : "Resource added"
      )
      invalidate()
      if (addAnotherPending) {
        setAddAnotherPending(false)
        setEditing(null)
        setForm(empty)
        // keep createOpen = true for another entry
      } else {
        setCreateOpen(false)
        setEditing(null)
        setForm(empty)
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save resource"),
  })

  const deleteMutation = useMutation({
    mutationFn: (resourceId: string) => contentsApi.deleteResource(resourceId),
    onSuccess: () => {
      toast.success("Resource removed")
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete resource"),
  })

  const reviewMutation = useMutation({
    mutationFn: (input: {
      resourceId: string
      approvalState: "APPROVED" | "REJECTED"
      reviewNote?: string | null
    }) =>
      contentsApi.reviewResource(input.resourceId, {
        approvalState: input.approvalState,
        reviewNote: input.reviewNote ?? null,
      }),
    onSuccess: (resource) => {
      toast.success(
        resource.approvalState === "APPROVED" ? "Rental approved" : "Rental rejected"
      )
      invalidate()
      setReviewTarget(null)
      setReviewNote("")
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to record review"),
  })

  const submit = () => {
    const validationError = firstValidationError(
      validateRequiredText(form.name, "Name"),
      validatePositiveInteger(form.quantity || "1", { label: "Quantity" }),
      form.sourceType === "RENTAL"
        ? firstValidationError(
            validateMoneyAmount(form.cost, { label: "Cost" }),
            validateCurrency(form.currency)
          )
        : null
    )
    if (validationError) {
      toast.error(validationError)
      return
    }
    saveMutation.mutate()
  }

  const submitReview = () => {
    if (!reviewTarget) return
    const validationError =
      reviewTarget.decision === "REJECTED" ? validateRequiredText(reviewNote, "Rejection reason") : null
    if (validationError) {
      toast.error(validationError)
      return
    }
    reviewMutation.mutate({
      resourceId: reviewTarget.resource.id,
      approvalState: reviewTarget.decision as "APPROVED" | "REJECTED",
      reviewNote: reviewNote.trim() || null,
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Coins className="h-4 w-4 text-muted-foreground" />
          Resources
          <span className="text-xs font-normal text-muted-foreground">
            ({node.resources.length}
            {node.resources.length > 0 && ` · ${counts.inHouse} in-house · ${counts.rental} rental`}
            {counts.pending > 0 && ` · ${counts.pending} pending`})
          </span>
        </div>
        <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      {counts.pending > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {counts.pending} rental resource{counts.pending === 1 ? "" : "s"} awaiting approval from{" "}
            <span className="font-semibold">{verticalName}</span>. The node cannot be marked
            completed until each is approved.
          </span>
        </div>
      )}

      {node.resources.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          No resources logged.
        </div>
      ) : (
        <ul className="space-y-2">
          {node.resources.map((resource) => {
            const isRental = resource.sourceType === "RENTAL"
            const cost = Number(resource.cost ?? 0) || 0
            const qty = resource.quantity
            const line = cost * qty
            const currency = resource.currency ?? ""
            const approvalState: ResourceApprovalState = resource.approvalState
            const showReviewControls =
              isRental && canReviewRentals && approvalState !== "APPROVED"
            const showRejectOnly =
              isRental && canReviewRentals && approvalState === "APPROVED"

            return (
              <li
                key={resource.id}
                className="flex items-start justify-between gap-3 overflow-hidden rounded-md border border-border bg-background px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Badge variant={isRental ? "warning" : "secondary"} className="gap-1 text-[10px] uppercase tracking-wider">
                        {isRental ? <Truck className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                        {isRental ? "Rental" : "In-house"}
                      </Badge>
                      {isRental ? (
                        <Badge variant={APPROVAL_BADGE_VARIANT[approvalState]} className="text-[10px] uppercase tracking-wider">
                          {approvalState === "PENDING"
                            ? "Pending"
                            : approvalState === "APPROVED"
                              ? "Approved"
                              : "Rejected"}
                        </Badge>
                      ) : (
                        <Badge variant="success" className="text-[10px] uppercase tracking-wider">
                          Approved
                        </Badge>
                      )}
                      <div className="min-w-0 truncate text-sm font-semibold text-foreground">{resource.name}</div>
                    </div>
                    {isRental && currency && (
                      <div className="text-sm font-semibold tabular-nums">
                        {formatMoney(line, currency)}
                      </div>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-foreground/70">
                    {isRental && currency ? (
                      <span className="font-medium tabular-nums">
                        {qty} × {formatMoney(cost, currency)}
                      </span>
                    ) : (
                      <span>Qty {qty}</span>
                    )}
                    {resource.notes && (
                      <>
                        <span className="text-border">·</span>
                        <span className="line-clamp-1 italic">{resource.notes}</span>
                      </>
                    )}
                  </div>

                  {isRental && (
                    <div className="mt-1.5 space-y-0.5 text-[11px] text-foreground/60">
                      {resource.requestedBy && (
                        <div>
                          Requested by{" "}
                          <span className="font-medium text-foreground/90">
                            {resource.requestedBy.name}
                          </span>
                          {" "}on {formatDate(resource.createdAt)}
                        </div>
                      )}
                      {resource.reviewedBy && resource.reviewedAt && (
                        <div>
                          {approvalState === "APPROVED" ? "Approved" : "Rejected"} by{" "}
                          <span className="font-medium text-foreground/90">
                            {resource.reviewedBy.name}
                          </span>
                          {" "}on {formatDate(resource.reviewedAt)}
                          {resource.reviewNote && (
                            <>
                              {" "}—{" "}
                              <span className="italic text-foreground/80">{resource.reviewNote}</span>
                            </>
                          )}
                        </div>
                      )}
                      {!canReviewRentals && approvalState === "PENDING" && (
                        <div className="text-amber-500/80">Awaiting approval from {verticalName}.</div>
                      )}
                    </div>
                  )}

                  {(showReviewControls || showRejectOnly) && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {showReviewControls && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1.5 border-emerald-600/50 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400"
                          title="Approve this rental resource"
                          onClick={() => {
                            setReviewTarget({ resource, decision: "APPROVED" })
                            setReviewNote(resource.reviewNote ?? "")
                          }}
                          disabled={reviewMutation.isPending}
                        >
                          <Check className="h-3.5 w-3.5" /> Approve
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10"
                        title="Reject this rental resource"
                        onClick={() => {
                          setReviewTarget({ resource, decision: "REJECTED" })
                          setReviewNote(resource.reviewNote ?? "")
                        }}
                        disabled={reviewMutation.isPending}
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => openEdit(resource)}
                    aria-label="Edit resource"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMutation.mutate(resource.id)}
                    disabled={deleteMutation.isPending}
                    aria-label="Delete resource"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {totalsByCurrency.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-3 text-xs">
          <span className="text-muted-foreground">Rental subtotal</span>
          {totalsByCurrency.map(([currency, total]) => (
            <span key={currency} className="font-semibold tabular-nums">
              {formatMoney(total, currency)}
            </span>
          ))}
        </div>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) {
            setEditing(null)
            setForm(empty)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit resource" : "Add resource"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Source *</Label>
              <Select
                value={form.sourceType}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, sourceType: v as ResourceSourceType }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN_HOUSE">
                    <span className="inline-flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5" /> In-house
                    </span>
                  </SelectItem>
                  <SelectItem value="RENTAL">
                    <span className="inline-flex items-center gap-2">
                      <Truck className="h-3.5 w-3.5" /> Rental
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {form.sourceType === "RENTAL"
                  ? `Rental items track cost and currency, and need approval from ${verticalName} before the node can be completed.`
                  : "In-house items don't carry cost, currency, or approval."}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                placeholder={form.sourceType === "RENTAL" ? "Camera rental" : "In-house lighting kit"}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            {form.sourceType === "RENTAL" ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Cost *</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={form.cost}
                    onChange={(e) => setForm((p) => ({ ...p, cost: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={form.quantity}
                    onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency *</Label>
                  <Input
                    value={form.currency}
                    maxLength={3}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, currency: e.target.value.toUpperCase() }))
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  className="max-w-[160px]"
                  value={form.quantity}
                  onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>

            {form.sourceType === "RENTAL" && editing && editing.sourceType === "IN_HOUSE" && (
              <div className="flex items-start gap-2 rounded-md border border-amber-600/40 bg-amber-500/10 p-2 text-xs text-amber-500">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Switching this resource to Rental will reset its approval to Pending and route it
                  back to {verticalName} for review.
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            {!editing && (
              <Button
                variant="secondary"
                onClick={() => { setAddAnotherPending(true); submit() }}
                disabled={saveMutation.isPending}
              >
                Save & add another
              </Button>
            )}
            <Button onClick={submit} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : editing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(reviewTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setReviewTarget(null)
            setReviewNote("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewTarget?.decision === "APPROVED" ? "Approve rental" : "Reject rental"}
            </DialogTitle>
          </DialogHeader>
          {reviewTarget && (
            <div className="space-y-3">
              <div className="rounded-md border border-border bg-background p-3 text-sm">
                <div className="font-medium">{reviewTarget.resource.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {reviewTarget.resource.currency
                    ? `${reviewTarget.resource.quantity} × ${formatMoney(
                        Number(reviewTarget.resource.cost ?? 0),
                        reviewTarget.resource.currency
                      )}`
                    : `Qty ${reviewTarget.resource.quantity}`}
                  {reviewTarget.resource.requestedBy && (
                    <> · requested by {reviewTarget.resource.requestedBy.name}</>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>
                  Note {reviewTarget.decision === "REJECTED" ? "*" : "(optional)"}
                </Label>
                <Textarea
                  rows={3}
                  value={reviewNote}
                  placeholder={
                    reviewTarget.decision === "REJECTED"
                      ? "Tell the requester why so they can revise."
                      : "Optional context for the requester."
                  }
                  onChange={(e) => setReviewNote(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReviewTarget(null)
                setReviewNote("")
              }}
              disabled={reviewMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={reviewTarget?.decision === "REJECTED" ? "destructive" : "default"}
              onClick={submitReview}
              disabled={reviewMutation.isPending}
              className="gap-1.5"
            >
              {reviewTarget?.decision === "REJECTED" ? (
                <CircleSlash className="h-3.5 w-3.5" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {reviewMutation.isPending
                ? "Saving..."
                : reviewTarget?.decision === "REJECTED"
                  ? "Reject"
                  : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
