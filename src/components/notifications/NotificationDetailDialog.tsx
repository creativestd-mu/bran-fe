import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { validateRequiredText } from "@/lib/validation"
import {
  CheckCircle2,
  Coins,
  ExternalLink,
  FileVideo,
  Hash,
  Layers,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  User as UserIcon,
  XCircle,
} from "lucide-react"
import {
  parseNotificationPayload,
  type NodeReadyData,
  type Notification,
  type ResourceRequestedData,
  type ResourceReviewedData,
} from "@/types"
import { contentsApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Props {
  notification: Notification | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onMarkRead: (id: string) => void
}

function deepLinkFor(parsed: Record<string, unknown> | null): string | null {
  if (!parsed) return null
  // Always derive the FE path from contentId + nodeId. We intentionally do not
  // trust an arbitrary `link` field from the backend payload, because it often
  // contains the API path (e.g. /en/v1/contents/...) which doesn't match any
  // FE route and would fall through to the dashboard catch-all.
  const contentId = typeof parsed.contentId === "string" ? parsed.contentId : null
  if (contentId) {
    const toNode = parsed.toNode as { id?: string } | undefined
    const node = parsed.node as { id?: string } | undefined
    const nodeId = toNode?.id ?? node?.id
    return nodeId ? `/contents/${contentId}?nodeId=${nodeId}` : `/contents/${contentId}`
  }
  // Only fall back to the backend `link` if it clearly points at an FE route.
  const link = typeof parsed.link === "string" ? parsed.link : null
  if (link && link.startsWith("/contents/")) return link
  return null
}

function formatCost(cost: string | null, currency: string | null, qty: number) {
  if (!cost) return null
  const numeric = Number(cost)
  if (Number.isNaN(numeric)) return null
  const total = numeric * (qty || 1)
  const c = currency ?? "INR"
  return `${c} ${total.toLocaleString()} (${qty} × ${c} ${numeric.toLocaleString()})`
}

export function NotificationDetailDialog({
  notification,
  open,
  onOpenChange,
  onMarkRead,
}: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [reviewNote, setReviewNote] = useState("")

  // Reset note whenever the dialog opens for a different notification.
  useEffect(() => {
    if (open) setReviewNote("")
  }, [open, notification?.id])

  const reviewResource = useMutation({
    mutationFn: (input: { resourceId: string; approvalState: "APPROVED" | "REJECTED" }) =>
      contentsApi.reviewResource(input.resourceId, {
        approvalState: input.approvalState,
        reviewNote: reviewNote.trim() ? reviewNote.trim() : null,
      }),
    onSuccess: (_, vars) => {
      toast.success(
        vars.approvalState === "APPROVED" ? "Rental approved" : "Rental rejected"
      )
      if (notification && !notification.readAt) onMarkRead(notification.id)
      queryClient.invalidateQueries({ queryKey: ["contents"] })
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
      onOpenChange(false)
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Couldn't update rental"
      toast.error(message)
    },
  })

  if (!notification) return null

  const data = parseNotificationPayload<Record<string, unknown>>(notification)
  const link = deepLinkFor(data)

  const handleViewInWorkflow = () => {
    if (notification && !notification.readAt) onMarkRead(notification.id)
    if (link) {
      onOpenChange(false)
      navigate(link)
    }
  }

  // For known kinds we render fully structured content below, so suppress the
  // backend's plain-text body to avoid duplicating every field.
  const HAS_STRUCTURED_BODY: Record<string, boolean> = {
    CONTENT_NODE_READY: true,
    CONTENT_RESOURCE_REQUESTED: true,
    CONTENT_RESOURCE_REVIEWED: true,
  }
  const showRawBody = !HAS_STRUCTURED_BODY[notification.kind] && Boolean(notification.body)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <NotificationIcon notification={notification} data={data} />
            <DialogTitle className="text-base">{notification.title}</DialogTitle>
          </div>
          {showRawBody && (
            <DialogDescription className="whitespace-pre-line text-sm">
              {notification.body}
            </DialogDescription>
          )}
        </DialogHeader>

        <NotificationBody notification={notification} data={data} />

        <NotificationActions
          notification={notification}
          data={data}
          link={link}
          reviewNote={reviewNote}
          onReviewNoteChange={setReviewNote}
          onApprove={(resourceId) =>
            reviewResource.mutate({ resourceId, approvalState: "APPROVED" })
          }
          onReject={(resourceId) => {
            const validationError = validateRequiredText(reviewNote, "Rejection reason")
            if (validationError) {
              toast.error(validationError)
              return
            }
            reviewResource.mutate({ resourceId, approvalState: "REJECTED" })
          }}
          onViewInWorkflow={handleViewInWorkflow}
          onClose={() => onOpenChange(false)}
          isPending={reviewResource.isPending}
        />
      </DialogContent>
    </Dialog>
  )
}

function NotificationIcon({
  notification,
  data,
}: {
  notification: Notification
  data: Record<string, unknown> | null
}) {
  if (notification.kind === "CONTENT_NODE_READY") {
    return <FileVideo className="h-4 w-4 text-blue-500 dark:text-blue-400" />
  }
  if (notification.kind === "CONTENT_RESOURCE_REQUESTED") {
    return <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
  }
  if (notification.kind === "CONTENT_RESOURCE_REVIEWED") {
    const decision = (data as Partial<ResourceReviewedData> | null)?.resource?.approvalState
    if (decision === "REJECTED")
      return <XCircle className="h-4 w-4 text-destructive" />
    return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
  }
  return null
}

function NotificationBody({
  notification,
  data,
}: {
  notification: Notification
  data: Record<string, unknown> | null
}) {
  if (notification.kind === "CONTENT_NODE_READY") {
    const d = data as Partial<NodeReadyData> | null
    return (
      <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3 text-sm">
        <Row icon={<FileVideo className="h-3.5 w-3.5" />} label="Content">
          {d?.contentTitle ?? "—"}
        </Row>
        {d?.fromNode && d?.toNode && (
          <Row icon={<Layers className="h-3.5 w-3.5" />} label="Stage">
            {d.fromNode.name} → <span className="font-medium">{d.toNode.name}</span>
          </Row>
        )}
        {d?.approvedOutput && (
          <Row icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Approved output">
            <a
              href={d.approvedOutput.url}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              {d.approvedOutput.label} (v{d.approvedOutput.version})
            </a>
          </Row>
        )}
      </div>
    )
  }

  if (notification.kind === "CONTENT_RESOURCE_REQUESTED") {
    const d = data as Partial<ResourceRequestedData> | null
    const cost = d?.resource
      ? formatCost(d.resource.cost, d.resource.currency, d.resource.quantity)
      : null
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          This node can't be marked completed until the rental is approved.
        </p>
        <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3 text-sm">
          <Row icon={<FileVideo className="h-3.5 w-3.5" />} label="Content">
            {d?.contentTitle ?? "—"}
          </Row>
          {d?.node && (
            <Row icon={<Layers className="h-3.5 w-3.5" />} label="Node">
              {d.node.name}
            </Row>
          )}
          {d?.resource && (
            <Row icon={<Hash className="h-3.5 w-3.5" />} label="Resource">
              <span className="font-medium">{d.resource.name}</span>
              <span className="ml-1 text-xs text-muted-foreground">
                × {d.resource.quantity}
              </span>
            </Row>
          )}
          {cost && (
            <Row icon={<Coins className="h-3.5 w-3.5" />} label="Cost">
              {cost}
            </Row>
          )}
          {d?.requestedBy && (
            <Row icon={<UserIcon className="h-3.5 w-3.5" />} label="Requested by">
              {d.requestedBy.name}
            </Row>
          )}
          {d?.resource?.notes && (
            <div className="rounded border border-border bg-background p-2 text-xs italic text-muted-foreground">
              "{d.resource.notes}"
            </div>
          )}
        </div>
      </div>
    )
  }

  if (notification.kind === "CONTENT_RESOURCE_REVIEWED") {
    const d = data as Partial<ResourceReviewedData> | null
    const approved = d?.resource?.approvalState === "APPROVED"
    return (
      <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3 text-sm">
        <Row icon={<FileVideo className="h-3.5 w-3.5" />} label="Content">
          {d?.contentTitle ?? "—"}
        </Row>
        {d?.node && (
          <Row icon={<Layers className="h-3.5 w-3.5" />} label="Node">
            {d.node.name}
          </Row>
        )}
        {d?.resource && (
          <Row icon={<Hash className="h-3.5 w-3.5" />} label="Resource">
            {d.resource.name}
          </Row>
        )}
        <Row icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Decision">
          <Badge variant={approved ? "success" : "destructive"} className="text-[10px]">
            {d?.resource?.approvalState ?? "REVIEWED"}
          </Badge>
        </Row>
        {d?.reviewedBy && (
          <Row icon={<UserIcon className="h-3.5 w-3.5" />} label="Reviewed by">
            {d.reviewedBy.name}
          </Row>
        )}
        {d?.resource?.reviewNote && (
          <div className="rounded border border-border bg-background p-2 text-xs italic text-muted-foreground">
            "{d.resource.reviewNote}"
          </div>
        )}
      </div>
    )
  }

  return null
}

interface ActionsProps {
  notification: Notification
  data: Record<string, unknown> | null
  link: string | null
  reviewNote: string
  onReviewNoteChange: (v: string) => void
  onApprove: (resourceId: string) => void
  onReject: (resourceId: string) => void
  onViewInWorkflow: () => void
  onClose: () => void
  isPending: boolean
}

function NotificationActions({
  notification,
  data,
  link,
  reviewNote,
  onReviewNoteChange,
  onApprove,
  onReject,
  onViewInWorkflow,
  onClose,
  isPending,
}: ActionsProps) {
  const isActionable =
    notification.kind === "CONTENT_RESOURCE_REQUESTED" &&
    typeof (data as Partial<ResourceRequestedData> | null)?.resource?.id === "string"

  const resourceId = isActionable
    ? (data as unknown as ResourceRequestedData).resource.id
    : null

  return (
    <div className="space-y-3">
      {isActionable && (
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground" htmlFor="review-note">
            Note (optional)
          </label>
          <Textarea
            id="review-note"
            placeholder="Reason for rejection or any approval notes…"
            value={reviewNote}
            onChange={(e) => onReviewNoteChange(e.target.value)}
            className="min-h-[64px]"
            disabled={isPending}
          />
        </div>
      )}

      <DialogFooter className="gap-2 sm:gap-2">
        {isActionable && resourceId ? (
          <>
            <Button
              variant="outline"
              className="gap-1.5 text-destructive hover:bg-destructive/10"
              disabled={isPending}
              onClick={() => onReject(resourceId)}
            >
              <ThumbsDown className="h-3.5 w-3.5" /> Reject
            </Button>
            <Button
              className="gap-1.5"
              disabled={isPending}
              onClick={() => onApprove(resourceId)}
            >
              <ThumbsUp className="h-3.5 w-3.5" /> Approve
            </Button>
            {link && (
              <Button
                variant="ghost"
                className="gap-1.5"
                disabled={isPending}
                onClick={onViewInWorkflow}
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open
              </Button>
            )}
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            {link && (
              <Button className="gap-1.5" onClick={onViewInWorkflow}>
                <ExternalLink className="h-3.5 w-3.5" /> Open in workflow
              </Button>
            )}
          </>
        )}
      </DialogFooter>
    </div>
  )
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-foreground">{children}</div>
      </div>
    </div>
  )
}
