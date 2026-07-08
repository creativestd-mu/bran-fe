import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CheckCircle2, ExternalLink, FileCheck, GitBranch, Pencil, Plus, Trash2 } from "lucide-react"
import { contentsApi } from "@/lib/api"
import {
  firstValidationError,
  normalizeUrl,
  validateRequiredSelection,
  validateRequiredText,
  validateUrl,
} from "@/lib/validation"
import type { ApprovalState, Content, ContentNode, ContentNodeOutput } from "@/types"
import {
  APPROVAL_BADGE,
  APPROVAL_TRANSITIONS,
  pretty,
} from "@/components/contents/contentMeta"
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
  canReview: boolean
}

interface FormState {
  label: string
  url: string
  notes: string
}

const empty: FormState = { label: "", url: "", notes: "" }

function formatRelative(iso: string | null) {
  if (!iso) return ""
  const date = new Date(iso)
  return date.toLocaleString()
}

export function OutputsSection({ node, content, canReview }: Props) {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<ContentNodeOutput | null>(null)
  const [form, setForm] = useState<FormState>(empty)
  const [reviewing, setReviewing] = useState<ContentNodeOutput | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [reviewForm, setReviewForm] = useState<{ approvalState: ApprovalState | ""; reviewNote: string }>({
    approvalState: "",
    reviewNote: "",
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["content", content.id] })

  const openCreate = () => {
    setEditing(null)
    setForm(empty)
    setCreateOpen(true)
  }

  const openEdit = (output: ContentNodeOutput) => {
    setEditing(output)
    setForm({ label: output.label, url: output.url, notes: output.notes ?? "" })
    setCreateOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        label: form.label.trim(),
        url: normalizeUrl(form.url),
        notes: form.notes.trim() || undefined,
      }
      if (editing) return contentsApi.updateOutput(editing.id, payload)
      return contentsApi.createOutput(node.id, payload)
    },
    onSuccess: () => {
      toast.success(editing ? "Output updated" : "Output submitted")
      invalidate()
      setCreateOpen(false)
      setEditing(null)
      setForm(empty)
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save output"),
  })

  const deleteMutation = useMutation({
    mutationFn: (outputId: string) => contentsApi.deleteOutput(outputId),
    onSuccess: () => {
      toast.success("Output deleted")
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete output"),
  })

  const reviewMutation = useMutation({
    mutationFn: () => {
      if (!reviewing || !reviewForm.approvalState) throw new Error("Pick a state")
      return contentsApi.reviewOutput(reviewing.id, {
        approvalState: reviewForm.approvalState as ApprovalState,
        reviewNote: reviewForm.reviewNote.trim() || null,
      })
    },
    onSuccess: () => {
      toast.success("Review recorded")
      invalidate()
      setReviewing(null)
      setReviewForm({ approvalState: "", reviewNote: "" })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to review output"),
  })

  const submit = () => {
    const validationError = firstValidationError(
      validateRequiredText(form.label, "Label"),
      validateUrl(form.url)
    )
    if (validationError) {
      toast.error(validationError)
      return
    }
    saveMutation.mutate()
  }

  const openReview = (output: ContentNodeOutput) => {
    setReviewing(output)
    const transitions = APPROVAL_TRANSITIONS[output.approvalState] ?? []
    const autoState = transitions.length === 1 ? transitions[0] : ""
    setReviewForm({ approvalState: autoState, reviewNote: output.reviewNote ?? "" })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileCheck className="h-4 w-4 text-muted-foreground" />
          Outputs
          <span className="text-xs font-normal text-muted-foreground">({node.outputs.length})</span>
        </div>
        <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> Submit
        </Button>
      </div>

      {node.outputs.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          No outputs submitted. The first submission starts a review chain.
        </div>
      ) : (
        <ul className="space-y-2">
          {node.outputs.map((output) => {
            const isApproved = output.approvalState === "APPROVED"
            const allowedTransitions = APPROVAL_TRANSITIONS[output.approvalState] ?? []
            return (
              <li
                key={output.id}
                className={`overflow-hidden rounded-md border bg-background p-3 ${
                  isApproved ? "border-emerald-600/40 ring-1 ring-emerald-600/20" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={APPROVAL_BADGE[output.approvalState]} className="gap-1">
                        {isApproved && <CheckCircle2 className="h-3 w-3" />}
                        {pretty(output.approvalState)}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <GitBranch className="h-3 w-3" /> v{output.version}
                      </Badge>
                      <span className="truncate text-sm font-medium">{output.label}</span>
                    </div>
                    <a
                      href={output.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-info hover:underline break-all"
                    >
                      {output.url}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                    {output.notes && (
                      <p className="text-xs text-muted-foreground">{output.notes}</p>
                    )}
                    {output.reviewNote && (
                      <p className="break-all rounded border border-border bg-muted/30 px-2 py-1.5 text-xs">
                        <span className="font-medium">Review note:</span> {output.reviewNote}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      {output.submittedBy?.name && (
                        <span>Submitted by {output.submittedBy.name}</span>
                      )}
                      {output.reviewedBy?.name && (
                        <span>
                          Reviewed by {output.reviewedBy.name}
                          {output.reviewedAt ? ` · ${formatRelative(output.reviewedAt)}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {canReview && allowedTransitions.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5"
                        onClick={() => openReview(output)}
                      >
                        Review
                      </Button>
                    )}
                    <div className="flex">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => openEdit(output)}
                        aria-label="Edit output"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirmDeleteId(output.id)}
                        disabled={deleteMutation.isPending}
                        aria-label="Delete output"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Create / edit dialog */}
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
            <DialogTitle>{editing ? "Edit output" : "Submit new output"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Label *</Label>
              <Input
                value={form.label}
                placeholder="V2 cut, color-graded"
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>URL *</Label>
              <Input
                type="url"
                value={form.url}
                placeholder="https://drive.google.com/..."
                onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
            {!editing && (
              <p className="text-xs text-muted-foreground">
                Submission starts in <span className="font-medium">PENDING</span>. Version is auto-assigned.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : editing ? "Save" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review dialog */}
      <Dialog
        open={Boolean(reviewing)}
        onOpenChange={(open) => {
          if (!open) {
            setReviewing(null)
            setReviewForm({ approvalState: "", reviewNote: "" })
          }
        }}
      >
        <DialogContent className="overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Review output{reviewing ? ` v${reviewing.version}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {reviewing && (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge variant={APPROVAL_BADGE[reviewing.approvalState]}>
                    {pretty(reviewing.approvalState)}
                  </Badge>
                  <span className="min-w-0 truncate font-medium">{reviewing.label}</span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>New state *</Label>
              <Select
                value={reviewForm.approvalState}
                onValueChange={(v) =>
                  setReviewForm((p) => ({ ...p, approvalState: v as ApprovalState }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a transition" />
                </SelectTrigger>
                <SelectContent>
                  {(reviewing ? APPROVAL_TRANSITIONS[reviewing.approvalState] : []).map((s) => (
                    <SelectItem key={s} value={s}>
                      {pretty(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Approving this will demote any previously approved output on this node back to <em>In review</em>.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea
                rows={3}
                value={reviewForm.reviewNote}
                placeholder="Optional comment for the submitter"
                onChange={(e) => setReviewForm((p) => ({ ...p, reviewNote: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(null)} disabled={reviewMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const validationError = validateRequiredSelection(reviewForm.approvalState, "Review state")
                if (validationError) {
                  toast.error(validationError)
                  return
                }
                reviewMutation.mutate()
              }}
              disabled={reviewMutation.isPending}
            >
              {reviewMutation.isPending ? "Saving..." : "Submit review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete confirmation dialog */}
      <Dialog open={Boolean(confirmDeleteId)} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete output?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone. The output and its review history will be permanently removed.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (confirmDeleteId) deleteMutation.mutate(confirmDeleteId)
                setConfirmDeleteId(null)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
