import type { Node } from "@xyflow/react"
import type { MemberRole, HierarchyKind, User } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { HierarchyNodeData } from "./hierarchyUtils"

interface NodeInspectorProps {
  node: Node<HierarchyNodeData> | null
  managerName: string | null
  managerUserId?: string | null
  managerOptions?: User[]
  kind?: HierarchyKind
  allowRemove?: boolean
  onRoleChange: (memberRole: MemberRole) => void
  onManagerChange?: (managerUserId: string | null) => void
  onSetTopLevel: () => void
  onRemove: () => void
}

const memberRoleOptions: MemberRole[] = ["LEAD", "MEMBER", "CONTRIBUTOR"]

export function NodeInspector({
  node,
  managerName,
  managerUserId = null,
  managerOptions = [],
  kind = "team",
  allowRemove = true,
  onRoleChange,
  onManagerChange,
  onSetTopLevel,
  onRemove,
}: NodeInspectorProps) {
  if (!node) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base text-accent">Inspector</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Select a node to edit details.</p>
        </CardContent>
      </Card>
    )
  }

  const initials = node.data.user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  const roleLabel = node.data.user.role?.name ? node.data.user.role.name.replace("_", " ") : "N/A"

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base text-accent">Inspector</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border border-border">
            <AvatarImage src={node.data.user.avatarUrl ?? undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{node.data.user.name}</p>
            <p className="text-xs text-muted-foreground">{node.data.user.email}</p>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Role</p>
          <Badge variant="outline" className="capitalize">
            {roleLabel}
          </Badge>
        </div>

        {kind !== "user" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Member role</p>
            <Select value={node.data.memberRole} onValueChange={(value) => onRoleChange(value as MemberRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {memberRoleOptions.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Manager</p>
          {onManagerChange ? (
            <Select
              value={managerUserId ?? "none"}
              onValueChange={(value) => onManagerChange(value === "none" ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="No manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No manager</SelectItem>
                {managerOptions.map((manager) => (
                  <SelectItem key={manager.id} value={manager.id}>
                    {manager.name}
                    {!manager.isActive ? " (inactive)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm">{managerName ?? "Top-level leader"}</p>
          )}
        </div>

        <div className="space-y-2">
          <Button variant="outline" className="w-full" onClick={onSetTopLevel}>
            Set as top-level
          </Button>
          {allowRemove && (
            <Button variant="destructive" className="w-full" onClick={onRemove}>
              Remove from hierarchy
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
