import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { usersApi } from "@/lib/api"
import type { SocialAccount } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Save, Plus, Trash2 } from "lucide-react"

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const [form, setForm] = useState({ name: "", description: "", phone: "", designation: "" })
  const [saving, setSaving] = useState(false)
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [socialForm, setSocialForm] = useState({ platform: "YOUTUBE", platformAccountId: "", handle: "" })

  useEffect(() => {
    if (!user) return
    setForm({
      name: user.name,
      description: user.description || "",
      phone: user.phone || "",
      designation: user.designation || "",
    })
    usersApi.getSocialAccounts(user.id).then(setAccounts).catch(() => {})
  }, [user])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      await usersApi.update(user.id, form)
      await refreshUser()
      toast.success("Profile updated")
    } catch {
      toast.error("Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  const addSocial = async () => {
    if (!user || !socialForm.platformAccountId) return
    try {
      const account = await usersApi.addSocialAccount(user.id, {
        platform: socialForm.platform,
        platformAccountId: socialForm.platformAccountId,
        handle: socialForm.handle || undefined,
      })
      setAccounts((prev) => [...prev, account])
      setAddOpen(false)
      setSocialForm({ platform: "YOUTUBE", platformAccountId: "", handle: "" })
      toast.success("Social account linked")
    } catch {
      toast.error("Failed to add social account")
    }
  }

  const removeSocial = async (accountId: string) => {
    try {
      await usersApi.deleteSocialAccount(accountId)
      setAccounts((prev) => prev.filter((a) => a.id !== accountId))
      toast.success("Account removed")
    } catch {
      toast.error("Failed to remove account")
    }
  }

  if (!user) return null

  const initials = user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-brand text-2xl tracking-wide text-accent">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your personal information</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-4 pb-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user.avatarUrl ?? undefined} />
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-lg">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <Badge variant="outline" className="mt-1 capitalize">{user.role.name.replace("_", " ")}</Badge>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Designation</Label>
              <Input value={form.designation} onChange={(e) => setForm((p) => ({ ...p, designation: e.target.value }))} placeholder="Your role title" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone number" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Tell us about yourself" />
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-accent">Social Accounts</CardTitle>
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1">
            <Plus className="h-4 w-4" /> Link Account
          </Button>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No social accounts linked yet.</p>
          ) : (
            <div className="space-y-3">
              {accounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{acc.platform}</Badge>
                    <span className="text-sm">{acc.handle || acc.platformAccountId}</span>
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

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
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
              <Input value={socialForm.platformAccountId} onChange={(e) => setSocialForm((p) => ({ ...p, platformAccountId: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Handle (optional)</Label>
              <Input value={socialForm.handle} onChange={(e) => setSocialForm((p) => ({ ...p, handle: e.target.value }))} placeholder="@handle" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addSocial}>Link Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
