import { useEffect, useState } from "react"
import { rolesApi } from "@/lib/api"
import type { Role, Permission } from "@/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Plus, Shield, Users, Trash2 } from "lucide-react"

const BUILTIN_ROLES = ["admin", "manager", "content_creator"]

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [allPermissions, setAllPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ name: "", description: "" })
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set())

  const load = async () => {
    setLoading(true)
    try {
      const [r, p] = await Promise.all([rolesApi.list(), rolesApi.getAllPermissions()])
      setRoles(r)
      setAllPermissions(p)
    } catch {
      toast.error("Failed to load roles")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!createForm.name.trim()) return
    try {
      await rolesApi.create(createForm)
      toast.success("Role created")
      setCreateOpen(false)
      setCreateForm({ name: "", description: "" })
      load()
    } catch {
      toast.error("Failed to create role")
    }
  }

  const handleDelete = async (role: Role) => {
    if (BUILTIN_ROLES.includes(role.name)) {
      toast.error("Cannot delete built-in roles")
      return
    }
    try {
      await rolesApi.delete(role.id)
      toast.success("Role deleted")
      load()
    } catch {
      toast.error("Failed to delete role")
    }
  }

  const openPermEditor = (role: Role) => {
    setEditingRole(role)
    setSelectedPerms(new Set(role.permissions.map((p) => p.id)))
  }

  const togglePerm = (permId: string) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev)
      if (next.has(permId)) next.delete(permId)
      else next.add(permId)
      return next
    })
  }

  const savePermissions = async () => {
    if (!editingRole) return
    try {
      await rolesApi.updatePermissions(editingRole.id, Array.from(selectedPerms))
      toast.success("Permissions updated")
      setEditingRole(null)
      load()
    } catch {
      toast.error("Failed to update permissions")
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-brand text-2xl tracking-wide text-accent">Roles & Permissions</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage access control for your team</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Create Role
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => (
          <Card key={role.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-accent" />
                  <CardTitle className="text-lg capitalize">{role.name.replace("_", " ")}</CardTitle>
                </div>
                {!BUILTIN_ROLES.includes(role.name) && (
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(role)} title="Delete role">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
              {role.description && <CardDescription>{role.description}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {role._count.users} users</span>
                <span>{role.permissions.length} permissions</span>
              </div>
              <Separator />
              <div className="flex flex-wrap gap-1">
                {role.permissions.slice(0, 5).map((p) => (
                  <Badge key={p.id} variant="secondary" className="text-[10px]">{p.name}</Badge>
                ))}
                {role.permissions.length > 5 && (
                  <Badge variant="outline" className="text-[10px]">+{role.permissions.length - 5} more</Badge>
                )}
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => openPermEditor(role)}>
                Edit Permissions
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New Role</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Role Name</Label>
              <Input value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. editor" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={createForm.description} onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingRole} onOpenChange={() => setEditingRole(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Permissions for {editingRole?.name.replace("_", " ")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {allPermissions.map((perm) => (
              <label key={perm.id} className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="checkbox"
                  checked={selectedPerms.has(perm.id)}
                  onChange={() => togglePerm(perm.id)}
                  className="h-4 w-4 rounded accent-primary"
                />
                <div>
                  <p className="text-sm font-medium">{perm.name}</p>
                  {perm.description && <p className="text-xs text-muted-foreground">{perm.description}</p>}
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRole(null)}>Cancel</Button>
            <Button onClick={savePermissions}>Save Permissions</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
