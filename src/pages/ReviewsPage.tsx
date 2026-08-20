import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  Check,
  ClipboardCheck,
  Download,
  ExternalLink,
  Loader2,
  Plus,
  Settings2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { reviewApi, usersApi } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import type { ReviewReminderPreference, ReviewRequest, ReviewStatus, User } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type DirectionTab = "incoming" | "outgoing"

function statusBadge(status: ReviewStatus) {
  if (status === "accepted") {
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">Accepted</Badge>
  }
  if (status === "rejected") {
    return <Badge variant="destructive">Rejected</Badge>
  }
  return <Badge variant="secondary">Pending</Badge>
}

function formatWhen(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export default function ReviewsPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<DirectionTab>("incoming")
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "all">("all")
  const [items, setItems] = useState<ReviewRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<User[]>([])

  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [requestedToId, setRequestedToId] = useState("")
  const [context, setContext] = useState("")
  const [fileUrl, setFileUrl] = useState("")
  const [file, setFile] = useState<File | null>(null)

  const [detail, setDetail] = useState<ReviewRequest | null>(null)
  const [respondOpen, setRespondOpen] = useState(false)
  const [decision, setDecision] = useState<"accepted" | "rejected">("accepted")
  const [comment, setComment] = useState("")
  const [responding, setResponding] = useState(false)

  const [prefsOpen, setPrefsOpen] = useState(false)
  const [prefs, setPrefs] = useState<ReviewReminderPreference | null>(null)
  const [prefsTimes, setPrefsTimes] = useState("11:00, 18:00")
  const [prefsEnabled, setPrefsEnabled] = useState(true)
  const [savingPrefs, setSavingPrefs] = useState(false)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const data = await reviewApi.list({ direction: tab, status: statusFilter })
      setItems(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load reviews")
    } finally {
      setLoading(false)
    }
  }, [statusFilter, tab])

  useEffect(() => {
    void fetchList()
  }, [fetchList])

  useEffect(() => {
    void usersApi
      .listAll({ isActive: true })
      .then(setUsers)
      .catch(() => {
        /* picker will be empty */
      })
  }, [])

  // Deep-link ?id=
  useEffect(() => {
    const id = searchParams.get("id")
    if (!id) return
    void reviewApi
      .get(id)
      .then((review) => {
        setDetail(review)
        setSearchParams({}, { replace: true })
      })
      .catch(() => {
        toast.error("Review not found")
        setSearchParams({}, { replace: true })
      })
  }, [searchParams, setSearchParams])

  const recipientOptions = useMemo(
    () => users.filter((u) => u.id !== user?.id && !u.isPlaceholder),
    [user?.id, users]
  )

  const openRespond = (review: ReviewRequest, next: "accepted" | "rejected") => {
    setDetail(review)
    setDecision(next)
    setComment("")
    setRespondOpen(true)
  }

  const handleCreate = async () => {
    if (!requestedToId) {
      toast.error("Pick someone to review")
      return
    }
    if (!context.trim()) {
      toast.error("Add some context")
      return
    }
    if (!fileUrl.trim() && !file) {
      toast.error("Provide a file link or upload a file")
      return
    }
    setCreating(true)
    try {
      await reviewApi.create({
        requestedToId,
        context: context.trim(),
        fileUrl: fileUrl.trim() || undefined,
        file: file ?? undefined,
      })
      toast.success("Review request sent")
      setCreateOpen(false)
      setRequestedToId("")
      setContext("")
      setFileUrl("")
      setFile(null)
      await fetchList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create review")
    } finally {
      setCreating(false)
    }
  }

  const handleRespond = async () => {
    if (!detail) return
    if (!comment.trim()) {
      toast.error("Comment is required")
      return
    }
    setResponding(true)
    try {
      const updated = await reviewApi.respond(detail.id, {
        decision,
        comment: comment.trim(),
      })
      toast.success(decision === "accepted" ? "Review accepted" : "Review rejected")
      setRespondOpen(false)
      setDetail(updated)
      await fetchList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to respond")
    } finally {
      setResponding(false)
    }
  }

  const openPrefs = async () => {
    setPrefsOpen(true)
    try {
      const data = await reviewApi.getReminderPreferences()
      setPrefs(data)
      setPrefsTimes(data.times.join(", "))
      setPrefsEnabled(data.enabled)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load reminder settings")
    }
  }

  const savePrefs = async () => {
    const times = prefsTimes
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
    if (times.length === 0) {
      toast.error("Add at least one HH:mm time (IST)")
      return
    }
    setSavingPrefs(true)
    try {
      const data = await reviewApi.updateReminderPreferences({
        times,
        enabled: prefsEnabled,
      })
      setPrefs(data)
      setPrefsTimes(data.times.join(", "))
      toast.success("Reminder settings saved")
      setPrefsOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings")
    } finally {
      setSavingPrefs(false)
    }
  }

  const downloadFile = async (review: ReviewRequest) => {
    try {
      const { blob, filename } = await reviewApi.downloadFile(review.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename || review.fileName || "review-file"
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed")
    }
  }

  const isReviewer = (review: ReviewRequest) => review.requestedToId === user?.id

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ClipboardCheck className="h-6 w-6" />
            Reviews
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Request peer reviews, accept or reject with comments, and get Slack reminders for
            pending items.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void openPrefs()}>
            <Settings2 className="mr-1.5 h-4 w-4" />
            Reminders
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New review
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["incoming", "outgoing"] as const).map((key) => (
          <Button
            key={key}
            size="sm"
            variant={tab === key ? "default" : "outline"}
            onClick={() => setTab(key)}
          >
            {key === "incoming" ? "Incoming" : "Outgoing"}
          </Button>
        ))}
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as ReviewStatus | "all")}
        >
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No reviews in this view yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((review) => (
            <Card
              key={review.id}
              className={cn("cursor-pointer transition hover:border-primary/40")}
              onClick={() => setDetail(review)}
            >
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    {tab === "incoming"
                      ? `From ${review.requestedBy.name}`
                      : `To ${review.requestedTo.name}`}
                  </CardTitle>
                  {statusBadge(review.status)}
                </div>
                <CardDescription>{formatWhen(review.createdAt)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="line-clamp-3 whitespace-pre-wrap text-sm">{review.context}</p>
                <div className="flex flex-wrap gap-2">
                  {review.fileUrl ? (
                    <Badge variant="outline" className="gap-1">
                      <ExternalLink className="h-3 w-3" />
                      Link
                    </Badge>
                  ) : null}
                  {review.storagePath ? (
                    <Badge variant="outline" className="gap-1">
                      <Download className="h-3 w-3" />
                      {review.fileName || "File"}
                    </Badge>
                  ) : null}
                  {isReviewer(review) && review.status === "pending" ? (
                    <>
                      <Button
                        size="sm"
                        className="h-7"
                        onClick={(e) => {
                          e.stopPropagation()
                          openRespond(review, "accepted")
                        }}
                      >
                        <Check className="mr-1 h-3.5 w-3.5" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7"
                        onClick={(e) => {
                          e.stopPropagation()
                          openRespond(review, "rejected")
                        }}
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New review request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Request review from</Label>
              <Select value={requestedToId} onValueChange={setRequestedToId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select teammate" />
                </SelectTrigger>
                <SelectContent>
                  {recipientOptions.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Context</Label>
              <Textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="What should they review? Any deadlines or notes…"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>File link (optional)</Label>
              <Input
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-2">
              <Label>Or upload a file (optional)</Label>
              <Input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">Max 25 MB. Provide a link and/or a file.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} disabled={creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail */}
      <Dialog open={Boolean(detail) && !respondOpen} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-lg">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Review details
                  {statusBadge(detail.status)}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p>
                  <span className="text-muted-foreground">From:</span> {detail.requestedBy.name}
                </p>
                <p>
                  <span className="text-muted-foreground">To:</span> {detail.requestedTo.name}
                </p>
                <p>
                  <span className="text-muted-foreground">Requested:</span>{" "}
                  {formatWhen(detail.createdAt)}
                </p>
                <div>
                  <p className="mb-1 text-muted-foreground">Context</p>
                  <p className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3">
                    {detail.context}
                  </p>
                </div>
                {detail.fileUrl ? (
                  <a
                    href={detail.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open file link
                  </a>
                ) : null}
                {detail.storagePath ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void downloadFile(detail)}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Download {detail.fileName || "file"}
                  </Button>
                ) : null}
                {detail.responseComment ? (
                  <div>
                    <p className="mb-1 text-muted-foreground">Response comment</p>
                    <p className="whitespace-pre-wrap rounded-md border p-3">
                      {detail.responseComment}
                    </p>
                  </div>
                ) : null}
              </div>
              <DialogFooter>
                {isReviewer(detail) && detail.status === "pending" ? (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => openRespond(detail, "rejected")}
                    >
                      Reject
                    </Button>
                    <Button onClick={() => openRespond(detail, "accepted")}>Accept</Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={() => setDetail(null)}>
                    Close
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Respond */}
      <Dialog open={respondOpen} onOpenChange={setRespondOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision === "accepted" ? "Accept review" : "Reject review"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Comment</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share feedback or reasons…"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={decision === "rejected" ? "destructive" : "default"}
              onClick={() => void handleRespond()}
              disabled={responding}
            >
              {responding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reminder prefs */}
      <Dialog open={prefsOpen} onOpenChange={setPrefsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review reminder settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Slack DMs for pending reviews you need to act on. Times are in IST (HH:mm), comma
              separated. Defaults are 11:00 and 18:00.
            </p>
            <div className="space-y-2">
              <Label>Reminder times (IST)</Label>
              <Input
                value={prefsTimes}
                onChange={(e) => setPrefsTimes(e.target.value)}
                placeholder="11:00, 18:00"
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prefsEnabled}
                onChange={(e) => setPrefsEnabled(e.target.checked)}
              />
              Enable Slack reminders
            </label>
            {prefs?.lastRemindedOn ? (
              <p className="text-xs text-muted-foreground">
                Last reminded: {prefs.lastRemindedOn} at {prefs.lastRemindedSlot} IST
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrefsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void savePrefs()} disabled={savingPrefs}>
              {savingPrefs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
