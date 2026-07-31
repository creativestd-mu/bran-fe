import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { rolesApi } from "@/lib/api"
import { formatRoleLabel } from "@/lib/utils"
import type { User } from "@/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableUserSelect } from "./SearchableUserSelect"

export interface NewHireFormValues {
  name: string
  designation: string
  roleId: string
  email: string
  managerUserId: string | null
}

interface NewHireDialogProps {
  open: boolean
  submitting?: boolean
  managerOptions?: User[]
  onOpenChange: (open: boolean) => void
  onSubmit: (values: NewHireFormValues) => Promise<void> | void
}

const emptyForm: NewHireFormValues = {
  name: "New Hire",
  designation: "",
  roleId: "",
  email: "",
  managerUserId: null,
}

export function NewHireDialog({
  open,
  submitting = false,
  managerOptions = [],
  onOpenChange,
  onSubmit,
}: NewHireDialogProps) {
  const [form, setForm] = useState<NewHireFormValues>(emptyForm)

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: () => rolesApi.list(),
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    setForm(emptyForm)
  }, [open])

  useEffect(() => {
    if (!open || form.roleId || !rolesQuery.data?.length) return
    const preferred =
      rolesQuery.data.find((role) => role.name === "content_creator") ??
      rolesQuery.data.find((role) => role.name === "executive") ??
      rolesQuery.data[0]
    if (preferred) {
      setForm((prev) => ({ ...prev, roleId: preferred.id }))
    }
  }, [open, form.roleId, rolesQuery.data])

  const handleSubmit = async () => {
    if (!form.roleId) return
    await onSubmit({
      name: form.name.trim() || "New Hire",
      designation: form.designation.trim(),
      roleId: form.roleId,
      email: form.email.trim(),
      managerUserId: form.managerUserId,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Hire Box</DialogTitle>
          <DialogDescription>
            Creates an open role on the org chart. It stays inactive until you convert it into a real user.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="new-hire-name">Display name</Label>
            <Input
              id="new-hire-name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="New Hire"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-hire-designation">Designation</Label>
            <Input
              id="new-hire-designation"
              value={form.designation}
              onChange={(e) => setForm((prev) => ({ ...prev, designation: e.target.value }))}
              placeholder="e.g. Content Creator"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={form.roleId} onValueChange={(roleId) => setForm((prev) => ({ ...prev, roleId }))}>
              <SelectTrigger>
                <SelectValue placeholder={rolesQuery.isLoading ? "Loading roles…" : "Select role"} />
              </SelectTrigger>
              <SelectContent>
                {(rolesQuery.data ?? []).map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {formatRoleLabel(role.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Manager</Label>
            <SearchableUserSelect
              users={managerOptions}
              value={form.managerUserId}
              onChange={(managerUserId) => setForm((prev) => ({ ...prev, managerUserId }))}
              noneLabel="No manager yet"
              placeholder="Select manager"
            />
            <p className="text-[11px] text-muted-foreground">
              Sets where this box sits on the org chart. You can change it later.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-hire-email">Email (optional)</Label>
            <Input
              id="new-hire-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="Leave blank for a placeholder address"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !form.roleId}>
            {submitting ? "Adding…" : "Add to chart"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
