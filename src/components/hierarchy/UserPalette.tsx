import { useMemo, useState } from "react"
import { UserPlus } from "lucide-react"
import type { User } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export const NEW_HIRE_DRAG_MIME = "application/bran-new-hire"

interface CanvasUserEntry {
  nodeId: string
  user: User
}

interface UserPaletteProps {
  users: User[]
  allowNewHire?: boolean
  canvasUsers?: CanvasUserEntry[]
  selectedNodeId?: string | null
  onSelectNode?: (nodeId: string) => void
  onAddNewHire?: () => void
}

function userInitials(user: User) {
  if (user.isPlaceholder) return "+"
  return user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function UserPalette({
  users,
  allowNewHire = false,
  canvasUsers = [],
  selectedNodeId = null,
  onSelectNode,
  onAddNewHire,
}: UserPaletteProps) {
  const [search, setSearch] = useState("")
  const query = search.trim().toLowerCase()

  const canvasByUserId = useMemo(() => {
    return new Map(canvasUsers.map((entry) => [entry.user.id, entry]))
  }, [canvasUsers])

  /** Directory + anyone already on the chart (covers freshly created placeholders). */
  const allUsers = useMemo(() => {
    const byId = new Map(users.map((user) => [user.id, user]))
    for (const entry of canvasUsers) {
      if (!byId.has(entry.user.id)) byId.set(entry.user.id, entry.user)
    }
    return [...byId.values()]
  }, [users, canvasUsers])

  const filteredUsers = useMemo(() => {
    return allUsers
      .filter((user) => {
        if (!query) return true
        const text = `${user.name} ${user.email} ${user.designation ?? ""}`.toLowerCase()
        return text.includes(query)
      })
      .sort((a, b) => {
        const aOn = canvasByUserId.has(a.id) ? 0 : 1
        const bOn = canvasByUserId.has(b.id) ? 0 : 1
        if (aOn !== bOn) return aOn - bOn
        if (Boolean(a.isPlaceholder) !== Boolean(b.isPlaceholder)) return a.isPlaceholder ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }, [allUsers, query, canvasByUserId])

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="shrink-0 space-y-3 p-3 sm:p-4">
        <CardTitle className="text-base text-accent">People</CardTitle>
        {allowNewHire && (
          <div className="space-y-2">
            <Button type="button" variant="outline" className="w-full gap-2 border-dashed" onClick={onAddNewHire}>
              <UserPlus className="h-4 w-4" />
              Add New Hire box
            </Button>
            <button
              type="button"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(NEW_HIRE_DRAG_MIME, "1")
                event.dataTransfer.effectAllowed = "copy"
              }}
              className="flex w-full items-center gap-2 rounded-lg border border-dashed border-accent/60 bg-accent/5 p-2.5 text-left transition hover:bg-accent/10"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-accent/50 text-accent">
                <UserPlus className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-accent">Or drag New Hire</p>
                <p className="text-xs text-muted-foreground">Drop on the chart for an open role</p>
              </div>
            </button>
          </div>
        )}
        <Input
          placeholder="Search users…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9"
        />
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pt-0 sm:p-4 sm:pt-0 [scrollbar-gutter:stable]">
        <div className="space-y-2 pr-1">
          {filteredUsers.map((user) => {
            const onCanvas = canvasByUserId.get(user.id)
            const isSelected = Boolean(onCanvas && onCanvas.nodeId === selectedNodeId)

            return (
              <button
                key={user.id}
                type="button"
                draggable={!onCanvas}
                onDragStart={(event) => {
                  if (onCanvas) {
                    event.preventDefault()
                    return
                  }
                  event.dataTransfer.setData("application/bran-user", JSON.stringify(user))
                  event.dataTransfer.effectAllowed = "copy"
                }}
                onClick={() => {
                  if (onCanvas) onSelectNode?.(onCanvas.nodeId)
                }}
                className={cn(
                  "w-full rounded-lg border p-2 text-left transition",
                  user.isPlaceholder && "border-dashed",
                  isSelected
                    ? "border-accent bg-accent/10"
                    : onCanvas
                      ? "border-border bg-muted/35 hover:bg-muted/50"
                      : "border-border bg-muted/20 hover:bg-muted/35"
                )}
              >
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarImage src={user.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-xs">{userInitials(user)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.isPlaceholder ? user.designation || "Open role" : user.email}
                    </p>
                  </div>
                  <Badge
                    variant={user.isPlaceholder ? "secondary" : user.isActive ? "outline" : "secondary"}
                    className="shrink-0 text-[10px]"
                  >
                    {user.isPlaceholder ? "new hire" : onCanvas ? "on chart" : user.isActive ? "active" : "inactive"}
                  </Badge>
                </div>
              </button>
            )
          })}
          {filteredUsers.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No users found.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
