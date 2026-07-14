import { useState } from "react"
import type { Node } from "@xyflow/react"
import type { MemberRole, HierarchyKind, User } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { HierarchyNodeData } from "./hierarchyUtils"

export interface ConvertPlaceholderValues {
  name: string
  email: string
  designation: string
}

interface NodeInspectorProps {
  node: Node<HierarchyNodeData> | null
  managerName: string | null
  managerUserId?: string | null
  managerOptions?: User[]
  kind?: HierarchyKind
  allowRemove?: boolean
  converting?: boolean
  onRoleChange: (memberRole: MemberRole) => void
  onManagerChange?: (managerUserId: string | null) => void
  onSetTopLevel: () => void
  onRemove: () => void
  onConvertPlaceholder?: (values: ConvertPlaceholderValues) => Promise<void> | void
}

const memberRoleOptions: MemberRole[] = ["LEAD", "MEMBER", "CONTRIBUTOR"]

export function NodeInspector({
  node,
  managerName,
  managerUserId = null,
  managerOptions = [],
  kind = "team",
  allowRemove = true,
  converting = false,
  onRoleChange,
  onManagerChange,
  onSetTopLevel,
  onRemove,
  onConvertPlaceholder,
}: NodeInspectorProps) {
  const [convertOpen, setConvertOpen] = useState(false)
  const [convertForm, setConvertForm] = useState<ConvertPlaceholderValues>({
    name: "",
    email: "",
    designation: "",
  })

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

  const isPlaceholder = Boolean(node.data.user.isPlaceholder)
  const initials = isPlaceholder
    ? "+"
    : node.data.user.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
  const roleLabel = node.data.user.role?.name ? node.data.user.role.name.replace("_", " ") : "N/A"

  const openConvert = () => {
    setConvertForm({
      name: node.data.user.name === "New Hire" ? "" : node.data.user.name,
      email: node.data.user.email.includes("@placeholder.internal") ? "" : node.data.user.email,
      designation: node.data.user.designation ?? "",
    })
    setConvertOpen(true)
  }

  const submitConvert = async () => {
    if (!convertForm.email.trim() || !onConvertPlaceholder) return
    await onConvertPlaceholder({
      name: convertForm.name.trim() || "New Hire",
      email: convertForm.email.trim(),
      designation: convertForm.designation.trim(),
    })
    setConvertOpen(false)
  }

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="shrink-0">
        <CardTitle className="text-base text-accent">Inspector</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border border-border">
            <AvatarImage src={node.data.user.avatarUrl ?? undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{node.data.user.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {isPlaceholder ? node.data.user.designation || "Open role" : node.data.user.email}
            </p>
          </div>
        </div>

        {isPlaceholder && (
          <Badge variant="secondary" className="border border-dashed">
            New hire placeholder
          </Badge>
        )}

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
                    {manager.isPlaceholder ? " (new hire)" : !manager.isActive ? " (inactive)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm">{managerName ?? "Top-level leader"}</p>
          )}
        </div>

        {isPlaceholder && onConvertPlaceholder && (
          <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
            {!convertOpen ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Convert this open role into a real user when you have their details.
                </p>
                <Button variant="outline" className="w-full" onClick={openConvert}>
                  Convert to real user
                </Button>
              </>
            ) : (
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="convert-name">Name</Label>
                  <Input
                    id="convert-name"
                    value={convertForm.name}
                    onChange={(e) => setConvertForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Real name"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="convert-email">Email</Label>
                  <Input
                    id="convert-email"
                    type="email"
                    value={convertForm.email}
                    onChange={(e) => setConvertForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="person@company.com"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="convert-designation">Designation</Label>
                  <Input
                    id="convert-designation"
                    value={convertForm.designation}
                    onChange={(e) => setConvertForm((prev) => ({ ...prev, designation: e.target.value }))}
                    placeholder="Job title"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setConvertOpen(false)} disabled={converting}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={submitConvert} disabled={converting || !convertForm.email.trim()}>
                    {converting ? "Saving…" : "Convert"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Button variant="outline" className="w-full" onClick={onSetTopLevel}>
            Set as top-level
          </Button>
          {allowRemove && (
            <Button variant="destructive" className="w-full" onClick={onRemove}>
              {isPlaceholder ? "Delete new hire box" : "Remove from hierarchy"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
