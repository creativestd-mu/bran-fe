import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { usersApi, rolesApi, tasksApi } from "@/lib/api"
import type { User, Role, Task, SocialAccount } from "@/types"
import { hasPermission } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react"
import {
  firstValidationError,
  validateIndianPhone,
  validateRequiredText,
} from "@/lib/validation"

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const canManageUsers = hasPermission(currentUser, "manage_users")
  const [user, setUser] = useState<User | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [managerOptions, setManagerOptions] = useState<User[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    phone: "",
    designation: "",
    roleId: "",
    managerUserId: null as string | null,
  })
  const [saving, setSaving] = useState(false)
  const [addSocialOpen, setAddSocialOpen] = useState(false)
  const [socialForm, setSocialForm] = useState({ platform: "YOUTUBE" as string, platformAccountId: "", handle: "" })

  useEffect(() => {
    if (!id) return
    const load = async () => {
      setLoading(true)
      try {
        const [userData, roleData, taskData, socialData, allUsers] = await Promise.all([
          usersApi.getById(id),
          rolesApi.list(),
          tasksApi.list({ userId: id, page: 1, pageSize: 20 }),
          usersApi.getSocialAccounts(id),
          usersApi.listAll(),
        ])
        setUser(userData)
        setRoles(roleData)
        setTasks(taskData.items)
        setSocialAccounts(socialData)
        setManagerOptions(allUsers.filter((u) => u.id !== id))
        setEditForm({
          name: userData.name,
          description: userData.description || "",
          phone: userData.phone || "",
          designation: userData.designation || "",
          roleId: userData.roleId,
          managerUserId: userData.managerUserId ?? null,
        })
      } catch {
        toast.error("Failed to load user details")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const handleSave = async () => {
    if (!id) return
    const validationError = firstValidationError(
      validateRequiredText(editForm.name, "Name"),
      validateIndianPhone(editForm.phone)
    )
    if (validationError) {
      toast.error(validationError)
      return
    }
    setSaving(true)
    try {
      const payload: Parameters<typeof usersApi.update>[1] = {
        name: editForm.name,
        description: editForm.description,
        phone: editForm.phone,
        designation: editForm.designation,
        roleId: editForm.roleId,
      }
      if (canManageUsers) {
        payload.managerUserId = editForm.managerUserId
      }
      const updated = await usersApi.update(id, payload)
      setUser(updated)
      toast.success("User updated")
    } catch {
      toast.error("Failed to update user")
    } finally {
      setSaving(false)
    }
  }

  const addSocial = async () => {
    if (!id) return
    const validationError = validateRequiredText(socialForm.platformAccountId, "Account ID")
    if (validationError) {
      toast.error(validationError)
      return
    }
    try {
      const account = await usersApi.addSocialAccount(id, {
        platform: socialForm.platform,
        platformAccountId: socialForm.platformAccountId,
        handle: socialForm.handle || undefined,
      })
      setSocialAccounts((prev) => [...prev, account])
      setAddSocialOpen(false)
      setSocialForm({ platform: "YOUTUBE", platformAccountId: "", handle: "" })
      toast.success("Social account linked")
    } catch {
      toast.error("Failed to add social account")
    }
  }

  const removeSocial = async (accountId: string) => {
    try {
      await usersApi.deleteSocialAccount(accountId)
      setSocialAccounts((prev) => prev.filter((a) => a.id !== accountId))
      toast.success("Social account removed")
    } catch {
      toast.error("Failed to remove social account")
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!user) return <p className="text-muted-foreground">User not found.</p>

  const initials = user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate("/users")} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to Users
      </Button>

      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={user.avatarUrl ?? undefined} />
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-xl font-semibold">{user.name}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="capitalize">{user.role.name.replace("_", " ")}</Badge>
            {user.manager && (
              <Badge variant="secondary" className="text-xs">
                Reports to {user.manager.name}
              </Badge>
            )}
          </div>
          {user.directReports && user.directReports.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Direct reports: {user.directReports.map((report) => report.name).join(", ")}
            </p>
          )}
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="social">Social Accounts</TabsTrigger>
          <TabsTrigger value="tasks">Task History</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader><CardTitle className="text-accent">Edit Profile</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Designation</Label>
                  <Input value={editForm.designation} onChange={(e) => setEditForm((p) => ({ ...p, designation: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={editForm.phone}
                    onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="9876543210 or +91 98765 43210"
                    inputMode="tel"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={editForm.roleId} onValueChange={(v) => setEditForm((p) => ({ ...p, roleId: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {canManageUsers && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Manager</Label>
                    <Select
                      value={editForm.managerUserId ?? "none"}
                      onValueChange={(v) => setEditForm((p) => ({ ...p, managerUserId: v === "none" ? null : v }))}
                    >
                      <SelectTrigger><SelectValue placeholder="No manager" /></SelectTrigger>
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
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} />
              </div>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-accent">Social Accounts</CardTitle>
              <Button size="sm" onClick={() => setAddSocialOpen(true)} className="gap-1">
                <Plus className="h-4 w-4" /> Link Account
              </Button>
            </CardHeader>
            <CardContent>
              {socialAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No social accounts linked.</p>
              ) : (
                <div className="space-y-3">
                  {socialAccounts.map((acc) => (
                    <div key={acc.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <Badge variant="outline">{acc.platform}</Badge>
                        <span className="ml-2 text-sm">{acc.handle || acc.platformAccountId}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeSocial(acc.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={addSocialOpen} onOpenChange={setAddSocialOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Link Social Account</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select value={socialForm.platform} onValueChange={(v) => setSocialForm((p) => ({ ...p, platform: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["YOUTUBE", "INSTAGRAM", "LINKEDIN", "FACEBOOK"].map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Account ID</Label>
                  <Input value={socialForm.platformAccountId} onChange={(e) => setSocialForm((p) => ({ ...p, platformAccountId: e.target.value }))} placeholder="Platform account ID" />
                </div>
                <div className="space-y-2">
                  <Label>Handle (optional)</Label>
                  <Input value={socialForm.handle} onChange={(e) => setSocialForm((p) => ({ ...p, handle: e.target.value }))} placeholder="@handle" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddSocialOpen(false)}>Cancel</Button>
                <Button onClick={addSocial}>Link Account</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader><CardTitle className="text-accent">Task History</CardTitle></CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No tasks found.</p>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{task.title}</p>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-[10px]">{task.type.replace("_", " ")}</Badge>
                          {task.platform && <Badge variant="outline" className="text-[10px]">{task.platform}</Badge>}
                        </div>
                      </div>
                      <Badge variant={task.status === "COMPLETED" ? "success" : task.status === "PENDING" ? "warning" : "secondary"} className="text-[10px]">
                        {task.status.replace("_", " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
