import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { contentsApi } from "@/lib/api"
import type { NodeKind } from "@/types"
import { NODE_KINDS, pretty } from "@/components/contents/contentMeta"
import { Button } from "@/components/ui/button"
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

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  contentId: string
  defaultOrderIndex: number
}

const empty = (orderIndex: number) => ({
  kind: "OTHER" as NodeKind,
  name: "",
  notes: "",
  startsAt: "",
  dueDate: "",
  orderIndex: String(orderIndex),
})

export function AddNodeDialog({ open, onOpenChange, contentId, defaultOrderIndex }: Props) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(empty(defaultOrderIndex))

  useEffect(() => {
    if (open) setForm(empty(defaultOrderIndex))
  }, [open, defaultOrderIndex])

  const createMutation = useMutation({
    mutationFn: () =>
      contentsApi.createNode(contentId, {
        kind: form.kind,
        name: form.name.trim(),
        orderIndex: form.orderIndex === "" ? undefined : Number(form.orderIndex),
        notes: form.notes.trim() || undefined,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
      }),
    onSuccess: () => {
      toast.success("Node added")
      queryClient.invalidateQueries({ queryKey: ["content", contentId] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add node"),
  })

  const submit = () => {
    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }
    if (form.orderIndex !== "") {
      const n = Number(form.orderIndex)
      if (!Number.isInteger(n) || n < 0) {
        toast.error("Order index must be a non-negative integer")
        return
      }
    }
    createMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add node</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Kind *</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => setForm((p) => ({ ...p, kind: v as NodeKind }))}
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
              <Label>Order index</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={form.orderIndex}
                onChange={(e) => setForm((p) => ({ ...p, orderIndex: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              value={form.name}
              placeholder="e.g. Pre-production review"
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Starts</Label>
              <Input
                type="date"
                value={form.startsAt}
                onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Due</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Adding..." : "Add node"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
