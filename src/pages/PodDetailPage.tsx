import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  FolderKanban,
  Plus,
  RefreshCw,
  Trash2,
  UserRound,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/contexts/AuthContext"
import { podsApi } from "@/lib/api"
import { firstValidationError, validateRequiredSelection, validateRequiredText } from "@/lib/validation"
import {
  hasPermission,
  type Pod,
  type PodSocialAccount,
  type PodSocialKind,
  type PodSocialPlatform,
  type PodSocialPost,
} from "@/types"

const KINDS: PodSocialKind[] = ["OWNED_IP", "INSPIRATION"]
const PLATFORMS: PodSocialPlatform[] = ["INSTAGRAM", "YOUTUBE", "X", "LINKEDIN"]

interface AccountForm {
  kind: PodSocialKind
  platform: PodSocialPlatform
  handle: string
  url: string
}

const emptyAccountForm = (kind: PodSocialKind = "OWNED_IP"): AccountForm => ({
  kind,
  platform: "INSTAGRAM",
  handle: "",
  url: "",
})

function kindLabel(kind: string) {
  return kind === "OWNED_IP" ? "Owned IP" : kind === "INSPIRATION" ? "Inspiration" : kind
}

function syncBadgeVariant(status?: string | null): "default" | "secondary" | "destructive" | "outline" {
  if (status === "SUCCESS") return "default"
  if (status === "ERROR") return "destructive"
  if (status === "SKIPPED") return "secondary"
  return "outline"
}

function formatMetric(metrics?: Record<string, number | null> | null) {
  if (!metrics) return "—"
  const parts: string[] = []
  if (typeof metrics.likes === "number") parts.push(`${metrics.likes} likes`)
  if (typeof metrics.comments === "number") parts.push(`${metrics.comments} comments`)
  if (typeof metrics.views === "number") parts.push(`${metrics.views} views`)
  if (typeof metrics.shares === "number") parts.push(`${metrics.shares} shares`)
  return parts.length > 0 ? parts.join(" · ") : "—"
}

export default function PodDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManage = hasPermission(user, "manage_pods")

  const [pod, setPod] = useState<Pod | null>(null)
  const [posts, setPosts] = useState<PodSocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [postsLoading, setPostsLoading] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)

  const [accountOpen, setAccountOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [accountForm, setAccountForm] = useState<AccountForm>(emptyAccountForm())

  const [kindFilter, setKindFilter] = useState<string>("ALL")
  const [platformFilter, setPlatformFilter] = useState<string>("ALL")

  const loadPod = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await podsApi.getById(id)
      setPod(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load pod")
      navigate("/pods")
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  const loadPosts = useCallback(async () => {
    if (!id) return
    setPostsLoading(true)
    try {
      const data = await podsApi.listPosts(id, {
        kind: kindFilter === "ALL" ? undefined : kindFilter,
        platform: platformFilter === "ALL" ? undefined : platformFilter,
        limit: 50,
      })
      setPosts(data)
    } catch {
      toast.error("Failed to load posts")
    } finally {
      setPostsLoading(false)
    }
  }, [id, kindFilter, platformFilter])

  useEffect(() => {
    void loadPod()
  }, [loadPod])

  useEffect(() => {
    void loadPosts()
  }, [loadPosts])

  const ownedAccounts = useMemo(
    () => (pod?.socialAccounts ?? []).filter((account) => account.kind === "OWNED_IP"),
    [pod]
  )
  const inspirationAccounts = useMemo(
    () => (pod?.socialAccounts ?? []).filter((account) => account.kind === "INSPIRATION"),
    [pod]
  )

  const openAddAccount = (kind: PodSocialKind) => {
    setAccountForm(emptyAccountForm(kind))
    setAccountOpen(true)
  }

  const handleAddAccount = async () => {
    if (!id) return
    const validationError = firstValidationError(
      validateRequiredSelection(accountForm.kind, "Kind"),
      validateRequiredSelection(accountForm.platform, "Platform"),
      validateRequiredText(accountForm.handle, "Handle")
    )
    if (validationError) {
      toast.error(validationError)
      return
    }
    setSaving(true)
    try {
      await podsApi.addAccount(id, {
        kind: accountForm.kind,
        platform: accountForm.platform,
        handle: accountForm.handle.trim(),
        url: accountForm.url.trim() || undefined,
      })
      toast.success("Account added")
      setAccountOpen(false)
      await loadPod()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add account")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async (account: PodSocialAccount) => {
    if (!canManage) return
    if (!window.confirm(`Remove @${account.handle} from this pod?`)) return
    try {
      await podsApi.deleteAccount(account.id)
      toast.success("Account removed")
      await Promise.all([loadPod(), loadPosts()])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove account")
    }
  }

  const handleSync = async (accountId: string) => {
    setSyncingId(accountId)
    try {
      const result = await podsApi.syncAccount(accountId)
      if (result.status === "SUCCESS") {
        toast.success(`Synced ${result.upserted} posts`)
      } else if (result.status === "SKIPPED") {
        toast.message(result.error ?? "Sync skipped")
      } else {
        toast.error(result.error ?? "Sync failed")
      }
      await Promise.all([loadPod(), loadPosts()])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed")
    } finally {
      setSyncingId(null)
    }
  }

  const renderAccountTable = (accounts: PodSocialAccount[], title: string, kind: PodSocialKind) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        {canManage && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openAddAccount(kind)}>
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No accounts yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platform</TableHead>
                <TableHead>Handle</TableHead>
                <TableHead>Sync</TableHead>
                <TableHead>Posts</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>
                    <Badge variant="outline">{account.platform}</Badge>
                  </TableCell>
                  <TableCell>
                    <a
                      href={account.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      @{account.handle}
                    </a>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant={syncBadgeVariant(account.lastSyncStatus)}>
                        {account.lastSyncStatus ?? "Never"}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {account.lastSyncedAt
                          ? new Date(account.lastSyncedAt).toLocaleString()
                          : "Not synced"}
                      </p>
                      {account.lastSyncError && (
                        <p className="max-w-xs truncate text-xs text-destructive">
                          {account.lastSyncError}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{account._count?.posts ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {canManage && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            disabled={syncingId === account.id}
                            onClick={() => handleSync(account.id)}
                          >
                            <RefreshCw
                              className={`h-3.5 w-3.5 ${syncingId === account.id ? "animate-spin" : ""}`}
                            />
                            Sync
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteAccount(account)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )

  if (loading || !pod) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="gap-1.5 px-0" onClick={() => navigate("/pods")}>
            <ArrowLeft className="h-4 w-4" />
            Back to pods
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-brand text-2xl tracking-wide text-accent">{pod.name}</h1>
              {!pod.isActive && <Badge variant="secondary">Inactive</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {pod.vertical?.name ?? "Vertical"} · Head: {pod.head?.name ?? "—"}
            </p>
            {pod.description && (
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{pod.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <UserRound className="h-4 w-4" />
          {pod.head?.email ?? "No head email"}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {renderAccountTable(ownedAccounts, "Owned IPs", "OWNED_IP")}
        {renderAccountTable(inspirationAccounts, "Inspirations", "INSPIRATION")}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Recent posts</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Kind" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All kinds</SelectItem>
                {KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {kindLabel(kind)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All platforms</SelectItem>
                {PLATFORMS.map((platform) => (
                  <SelectItem key={platform} value={platform}>
                    {platform}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => void loadPosts()} disabled={postsLoading}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {postsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No stored posts yet. Sync an account to pull content via Apify.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Post</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Metrics</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell>
                      <div className="max-w-md">
                        <p className="font-medium">
                          {post.title || post.caption?.slice(0, 80) || post.platformPostId}
                        </p>
                        {post.url && (
                          <a
                            href={post.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            Open
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="outline">{post.account?.platform}</Badge>
                        <p className="text-xs text-muted-foreground">
                          {kindLabel(post.account?.kind ?? "")} · @{post.account?.handle}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {post.publishedAt ? new Date(post.publishedAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatMetric(post.metrics)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderKanban className="h-4 w-4" />
            Projects on this pod
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(pod.projects ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No projects yet. Create one from Projects and select this pod.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(pod.projects ?? []).map((project) => (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="rounded-lg border border-border p-3 transition-colors hover:border-primary/50"
                >
                  <p className="font-medium">{project.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{project.status}</p>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add social account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Kind *</Label>
              <Select
                value={accountForm.kind}
                onValueChange={(value) =>
                  setAccountForm((prev) => ({ ...prev, kind: value as PodSocialKind }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {kindLabel(kind)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Platform *</Label>
              <Select
                value={accountForm.platform}
                onValueChange={(value) =>
                  setAccountForm((prev) => ({ ...prev, platform: value as PodSocialPlatform }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {platform}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Handle *</Label>
              <Input
                value={accountForm.handle}
                onChange={(e) => setAccountForm((prev) => ({ ...prev, handle: e.target.value }))}
                placeholder="mastersunion"
              />
            </div>
            <div className="space-y-2">
              <Label>URL (optional)</Label>
              <Input
                value={accountForm.url}
                onChange={(e) => setAccountForm((prev) => ({ ...prev, url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleAddAccount} disabled={saving}>
              {saving ? "Adding..." : "Add account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
