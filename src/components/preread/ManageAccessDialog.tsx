import { useEffect, useMemo, useState } from "react"
import { Loader2, X } from "lucide-react"
import type { PrereadMember, PrereadMemberRole, User } from "@/types"
import { SearchableUserSelect } from "@/components/hierarchy/SearchableUserSelect"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

interface AccessEntry {
  userId: string
  role: PrereadMemberRole
}

interface ManageAccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  users: User[]
  ownerId: string
  ownerName: string
  members: PrereadMember[]
  saving: boolean
  onSave: (members: AccessEntry[]) => void
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

export function ManageAccessDialog({
  open,
  onOpenChange,
  users,
  ownerId,
  ownerName,
  members,
  saving,
  onSave,
}: ManageAccessDialogProps) {
  const [entries, setEntries] = useState<AccessEntry[]>(
    members.map((m) => ({ userId: m.userId, role: m.role }))
  )
  const [pickerValue, setPickerValue] = useState<string | null>(null)

  useEffect(() => {
    if (open) setEntries(members.map((m) => ({ userId: m.userId, role: m.role })))
  }, [open, members])

  const eligibleUsers = useMemo(
    () => users.filter((user) => user.id !== ownerId && user.isActive && !user.isPlaceholder),
    [users, ownerId]
  )

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
  const memberById = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members])

  const selectedPeople = useMemo(
    () =>
      entries
        .map((entry) => {
          const fromMembers = memberById.get(entry.userId)?.user
          const fromUsers = userById.get(entry.userId)
          const name = fromMembers?.name ?? fromUsers?.name
          const email = fromMembers?.email ?? fromUsers?.email
          const avatarUrl = fromMembers?.avatarUrl ?? fromUsers?.avatarUrl
          if (!name) return null
          return { userId: entry.userId, role: entry.role, name, email, avatarUrl }
        })
        .filter((p): p is NonNullable<typeof p> => p !== null),
    [entries, memberById, userById]
  )

  const addUser = (userId: string | null) => {
    if (!userId || entries.some((e) => e.userId === userId)) return
    setEntries((prev) => [...prev, { userId, role: "viewer" }])
    setPickerValue(null)
  }

  const removeUser = (userId: string) => {
    setEntries((prev) => prev.filter((e) => e.userId !== userId))
  }

  const setRole = (userId: string, role: PrereadMemberRole) => {
    setEntries((prev) => prev.map((e) => (e.userId === userId ? { ...e, role } : e)))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share this preread</DialogTitle>
          <DialogDescription>
            Choose whether each person can only view it, or edit its content too.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <SearchableUserSelect
            users={eligibleUsers.filter((user) => !entries.some((e) => e.userId === user.id))}
            value={pickerValue}
            onChange={addUser}
            placeholder="Add a person"
            noneLabel="Select person to add"
          />

          <div className="max-h-72 space-y-1 overflow-y-auto">
            <div className="flex items-center gap-3 rounded-md px-1 py-1.5">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-xs">{initials(ownerName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{ownerName}</p>
                <p className="truncate text-xs text-muted-foreground">Owner</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">Owner</span>
            </div>

            {selectedPeople.length === 0 ? (
              <p className="px-1 py-3 text-sm text-muted-foreground">
                No one else has access yet.
              </p>
            ) : (
              selectedPeople.map((person) => (
                <div key={person.userId} className="flex items-center gap-3 rounded-md px-1 py-1.5">
                  <Avatar className="h-8 w-8 shrink-0">
                    {person.avatarUrl ? <AvatarImage src={person.avatarUrl} alt={person.name} /> : null}
                    <AvatarFallback className="text-xs">{initials(person.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{person.name}</p>
                    {person.email && (
                      <p className="truncate text-xs text-muted-foreground">{person.email}</p>
                    )}
                  </div>
                  <Select
                    value={person.role}
                    onValueChange={(value) => setRole(person.userId, value as PrereadMemberRole)}
                  >
                    <SelectTrigger className="h-8 w-[110px] shrink-0 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => removeUser(person.userId)}
                    aria-label={`Remove ${person.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => onSave(entries)} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
