import { useEffect, useMemo, useState } from "react"
import { Loader2, X } from "lucide-react"
import type { User } from "@/types"
import { SearchableUserSelect } from "@/components/hierarchy/SearchableUserSelect"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

interface ManageAccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  users: User[]
  ownerId: string
  memberUserIds: string[]
  saving: boolean
  onSave: (userIds: string[]) => void
}

export function ManageAccessDialog({
  open,
  onOpenChange,
  users,
  ownerId,
  memberUserIds,
  saving,
  onSave,
}: ManageAccessDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(memberUserIds)
  const [pickerValue, setPickerValue] = useState<string | null>(null)

  useEffect(() => {
    if (open) setSelectedIds(memberUserIds)
  }, [open, memberUserIds])

  const eligibleUsers = useMemo(
    () => users.filter((user) => user.id !== ownerId && user.isActive && !user.isPlaceholder),
    [users, ownerId]
  )

  const selectedUsers = useMemo(
    () => eligibleUsers.filter((user) => selectedIds.includes(user.id)),
    [eligibleUsers, selectedIds]
  )

  const addUser = (userId: string | null) => {
    if (!userId || selectedIds.includes(userId)) return
    setSelectedIds((prev) => [...prev, userId])
    setPickerValue(null)
  }

  const removeUser = (userId: string) => {
    setSelectedIds((prev) => prev.filter((id) => id !== userId))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage access</DialogTitle>
          <DialogDescription>
            Only people you add here can open this preread. The owner always has access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <SearchableUserSelect
            users={eligibleUsers.filter((user) => !selectedIds.includes(user.id))}
            value={pickerValue}
            onChange={addUser}
            placeholder="Add a person"
            noneLabel="Select person to add"
          />

          <div className="flex flex-wrap gap-2 min-h-[2rem]">
            {selectedUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No collaborators yet.</p>
            ) : (
              selectedUsers.map((user) => (
                <Badge key={user.id} variant="secondary" className="gap-1 pr-1">
                  {user.name}
                  <button
                    type="button"
                    className="rounded p-0.5 hover:bg-muted"
                    onClick={() => removeUser(user.id)}
                    aria-label={`Remove ${user.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => onSave(selectedIds)} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
