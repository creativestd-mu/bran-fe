import { useEffect, useState } from "react"
import type { AxiosError } from "axios"
import { useNavigate } from "react-router-dom"
import { usersApi, rolesApi } from "@/lib/api"
import type { User, Role, PaginatedResponse } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Search, ChevronLeft, ChevronRight, Plus } from "lucide-react"

type CreateUserApiError = {
  error?: string
  details?: string | { fieldErrors?: Record<string, string[]> }
}

const defaultCreateForm = {
  email: "",
  name: "",
  roleId: "",
  description: "",
  phone: "",
  designation: "",
  isActive: true,
}

export default function UsersPage() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1, hasNextPage: false })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [activeFilter, setActiveFilter] = useState<string>("all")
  const [createOpen, setCreateOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createForm, setCreateForm] = useState(defaultCreateForm)

  const fetchUsers = async (page = 1) => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page, pageSize: 20 }
      if (roleFilter !== "all") params.roleId = roleFilter
      if (activeFilter !== "all") params.isActive = activeFilter === "active"
      const res = await usersApi.list(params as { page?: number; pageSize?: number; roleId?: string; isActive?: boolean })
      setUsers(res.items)
      setPagination(res.pagination)
    } catch (err) {
      toast.error("Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    rolesApi.list().then(setRoles).catch(() => {})
    fetchUsers()
  }, [])

  useEffect(() => {
    fetchUsers(1)
  }, [roleFilter, activeFilter])

  const toggleActive = async (user: User) => {
    try {
      await usersApi.update(user.id, { isActive: !user.isActive })
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: !u.isActive } : u)))
      toast.success(`${user.name} ${user.isActive ? "deactivated" : "activated"}`)
    } catch {
      toast.error("Failed to update user status")
    }
  }

  const filtered = search
    ? users.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
    : users

  const initials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)

  const getCreateErrorMessage = (err: unknown) => {
    const fallback = "Failed to create user"
    const axiosErr = err as AxiosError<CreateUserApiError>
    const data = axiosErr?.response?.data

    if (!data) {
      return err instanceof Error && err.message ? err.message : fallback
    }

    if (data.error === "Validation error" && typeof data.details === "object" && data.details?.fieldErrors) {
      const firstFieldError = Object.values(data.details.fieldErrors).flat()[0]
      return firstFieldError ?? data.error
    }

    if (typeof data.details === "string" && data.details.trim()) {
      return data.details
    }

    return data.error ?? fallback
  }

  const createUser = async () => {
    if (!createForm.email.trim() || !createForm.name.trim() || !createForm.roleId) {
      toast.error("Email, name, and role are required")
      return
    }

    setCreateLoading(true)
    try {
      await usersApi.create({
        email: createForm.email.trim(),
        name: createForm.name.trim(),
        roleId: createForm.roleId,
        description: createForm.description.trim() || undefined,
        phone: createForm.phone.trim() || undefined,
        designation: createForm.designation.trim() || undefined,
        isActive: createForm.isActive,
      })
      toast.success("User created successfully")
      setCreateOpen(false)
      setCreateForm(defaultCreateForm)
      fetchUsers(1)
    } catch (err) {
      toast.error(getCreateErrorMessage(err))
    } finally {
      setCreateLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-brand text-2xl tracking-wide text-accent">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage team members and their roles</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 self-start">
          <Plus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={activeFilter} onValueChange={setActiveFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden md:table-cell">Designation</TableHead>
                    <TableHead className="hidden lg:table-cell">Last Login</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => (
                    <TableRow key={u.id} className="cursor-pointer" onClick={() => navigate(`/users/${u.id}`)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={u.avatarUrl ?? undefined} />
                            <AvatarFallback className="text-xs">{initials(u.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{u.name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{u.role.name.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {u.designation || "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={u.isActive}
                          onCheckedChange={() => toggleActive(u)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No users found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  {pagination.total} total users
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => fetchUsers(pagination.page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!pagination.hasNextPage}
                    onClick={() => fetchUsers(pagination.page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) setCreateForm(defaultCreateForm)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="name@example.com"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Name *</Label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Full name"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Role *</Label>
              <Select value={createForm.roleId} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, roleId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={createForm.phone}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="+91-9876543210"
              />
            </div>

            <div className="space-y-2">
              <Label>Designation</Label>
              <Input
                value={createForm.designation}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, designation: e.target.value }))}
                placeholder="Senior Content Creator"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Description</Label>
              <Input
                value={createForm.description}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Team member description"
              />
            </div>

            <div className="sm:col-span-2 flex items-center justify-between rounded-md border border-border p-3">
              <Label>Active user</Label>
              <Switch
                checked={createForm.isActive}
                onCheckedChange={(checked) => setCreateForm((prev) => ({ ...prev, isActive: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createLoading}>
              Cancel
            </Button>
            <Button onClick={createUser} disabled={createLoading}>
              {createLoading ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
