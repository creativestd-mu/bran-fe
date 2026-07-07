import { useMemo, useState } from "react"
import type { User } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface UserPaletteProps {
  users: User[]
}

export function UserPalette({ users }: UserPaletteProps) {
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [activeFilter, setActiveFilter] = useState("all")

  const roles = useMemo(() => {
    return [...new Set(users.map((user) => user.role.name))]
  }, [users])

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const text = `${user.name} ${user.email}`.toLowerCase()
      const searchMatch = !search.trim() || text.includes(search.trim().toLowerCase())
      const roleMatch = roleFilter === "all" || user.role.name === roleFilter
      const activeMatch = activeFilter === "all" || (activeFilter === "active" ? user.isActive : !user.isActive)
      return searchMatch && roleMatch && activeMatch
    })
  }, [users, search, roleFilter, activeFilter])

  return (
    <details className="group lg:contents">
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-accent lg:hidden [&::-webkit-details-marker]:hidden">
        User Palette
        <span className="text-xs text-muted-foreground group-open:hidden">Show</span>
        <span className="hidden text-xs text-muted-foreground group-open:inline">Hide</span>
      </summary>
      <Card className="h-full lg:block">
      <CardHeader className="space-y-3">
        <CardTitle className="text-base text-accent">User Palette</CardTitle>
        <Input placeholder="Search users" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {roles.map((role) => (
                <SelectItem key={role} value={role}>
                  {role.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="max-h-[40vh] space-y-2 overflow-y-auto lg:max-h-[62vh]">
        {filteredUsers.map((user) => {
          const initials = user.name
            .split(" ")
            .map((name) => name[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()
          return (
            <button
              key={user.id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("application/bran-user", JSON.stringify(user))
                event.dataTransfer.effectAllowed = "copy"
              }}
              className="w-full rounded-lg border border-border bg-muted/20 p-2 text-left transition hover:bg-muted/35"
            >
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8 border border-border">
                  <AvatarImage src={user.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                <Badge variant={user.isActive ? "outline" : "secondary"} className="text-[10px]">
                  {user.isActive ? "active" : "inactive"}
                </Badge>
              </div>
            </button>
          )
        })}
        {filteredUsers.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No users found.</p>}
      </CardContent>
    </Card>
    </details>
  )
}
