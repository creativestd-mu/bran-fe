import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Trash2, UsersRound } from "lucide-react"
import { contentsApi, usersApi } from "@/lib/api"
import { validateRequiredSelection } from "@/lib/validation"
import type { ContentNode, TeamRole } from "@/types"
import { TEAM_ROLES, pretty } from "@/components/contents/contentMeta"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Props {
  node: ContentNode
  contentId: string
}

export function TeamSection({ node, contentId }: Props) {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [userId, setUserId] = useState<string>("")
  const [role, setRole] = useState<TeamRole>("SCRIPTER")

  const usersQuery = useQuery({
    queryKey: ["users-picker"],
    queryFn: async () => (await usersApi.list({ page: 1, pageSize: 200 })).items,
  })

  const userById = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string }>()
    for (const u of usersQuery.data ?? []) map.set(u.id, { id: u.id, name: u.name, email: u.email })
    return map
  }, [usersQuery.data])

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["content", contentId] })

  const addMutation = useMutation({
    mutationFn: () => contentsApi.addTeamMember(node.id, { userId, role }),
    onSuccess: () => {
      toast.success("Team member added")
      invalidate()
      setAddOpen(false)
      setUserId("")
      setRole("SCRIPTER")
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add team member"),
  })

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => contentsApi.removeTeamMember(memberId),
    onSuccess: () => {
      toast.success("Team member removed")
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to remove team member"),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <UsersRound className="h-4 w-4 text-muted-foreground" />
          Team
          <span className="text-xs font-normal text-muted-foreground">({node.team.length})</span>
        </div>
        <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      {node.team.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          No team members on this node yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {node.team.map((member) => {
            const initial = (member.user.name ?? member.user.email ?? "?").charAt(0).toUpperCase()
            return (
              <li
                key={member.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs">{initial}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {member.user.name ?? member.user.email ?? "Unknown user"}
                    </div>
                    {member.user.email && member.user.name && (
                      <div className="truncate text-xs text-muted-foreground">{member.user.email}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="whitespace-nowrap">{pretty(member.role)}</Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeMutation.mutate(member.id)}
                    disabled={removeMutation.isPending}
                    aria-label="Remove team member"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add team member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>User *</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger>
                  <SelectValue placeholder={usersQuery.isLoading ? "Loading..." : "Select a user"} />
                </SelectTrigger>
                <SelectContent>
                  {(usersQuery.data ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} <span className="text-muted-foreground">· {u.email}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {userId && userById.get(userId) && (
                <p className="text-xs text-muted-foreground">
                  {userById.get(userId)!.name} — {userById.get(userId)!.email}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={role} onValueChange={(v) => setRole(v as TeamRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {pretty(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              The same user can hold multiple roles, and multiple users can share the same role.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={addMutation.isPending}>
              Cancel
            </Button>
            <Button
              disabled={addMutation.isPending}
              onClick={() => {
                const validationError = validateRequiredSelection(userId, "Team member")
                if (validationError) {
                  toast.error(validationError)
                  return
                }
                addMutation.mutate()
              }}
            >
              {addMutation.isPending ? "Adding..." : "Add member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
