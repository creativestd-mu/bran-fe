import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Circle,
  FileVideo,
  ShieldCheck,
  XCircle,
} from "lucide-react"
import { notificationsApi } from "@/lib/api"
import {
  parseNotificationPayload,
  type Notification,
  type NotificationKind,
  type NotificationsPage,
  type ResourceReviewedData,
} from "@/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NotificationDetailDialog } from "@/components/notifications/NotificationDetailDialog"

const REFRESH_INTERVAL_MS = 30_000
const PAGE_SIZE = 20

const LIST_KEY = ["notifications", "list"] as const
const UNREAD_KEY = ["notifications", "unread-count"] as const

function formatRelative(iso: string) {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const diffSec = Math.round((Date.now() - then) / 1000)
  if (diffSec < 45) return "just now"
  if (diffSec < 90) return "1m ago"
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`
  if (diffSec < 5400) return "1h ago"
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`
  if (diffSec < 172800) return "1d ago"
  return `${Math.round(diffSec / 86400)}d ago`
}

interface KindIconProps {
  kind: NotificationKind
  data: Record<string, unknown> | null
}

function KindIcon({ kind, data }: KindIconProps) {
  if (kind === "CONTENT_NODE_READY") {
    return <FileVideo className="h-4 w-4 text-blue-400" />
  }
  if (kind === "CONTENT_RESOURCE_REQUESTED") {
    return <ShieldCheck className="h-4 w-4 text-amber-400" />
  }
  if (kind === "CONTENT_RESOURCE_REVIEWED") {
    const decision = (data as Partial<ResourceReviewedData> | null)?.resource?.approvalState
    if (decision === "REJECTED") return <XCircle className="h-4 w-4 text-destructive" />
    return <CheckCircle2 className="h-4 w-4 text-emerald-400" />
  }
  return <Bell className="h-4 w-4 text-muted-foreground" />
}

export function NotificationsMenu() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [activeNotification, setActiveNotification] = useState<Notification | null>(null)

  // Lightweight badge poll: a single COUNT(*) — runs even when popover closed.
  const unreadCountQuery = useQuery({
    queryKey: UNREAD_KEY,
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: true,
  })

  // Full list: only fetched while popover is open (or filter changes).
  const listQuery = useQuery({
    queryKey: [...LIST_KEY, { unreadOnly }] as const,
    queryFn: () => notificationsApi.list({ take: PAGE_SIZE, unreadOnly }),
    enabled: open,
    refetchOnWindowFocus: false,
  })

  // When the list returns, treat its `unread` as authoritative for the badge.
  useEffect(() => {
    if (listQuery.data) {
      queryClient.setQueryData<{ count: number }>(UNREAD_KEY, { count: listQuery.data.unread })
    }
  }, [listQuery.data, queryClient])

  const page = listQuery.data
  const items = page?.items ?? []
  const unread = unreadCountQuery.data?.count ?? page?.unread ?? 0

  const parsedItems = useMemo(
    () =>
      items.map((n) => ({
        notification: n,
        data: parseNotificationPayload<Record<string, unknown>>(n),
      })),
    [items]
  )

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] })
      const now = new Date().toISOString()
      // Optimistically flip every cached page that contains this notification.
      queryClient.setQueriesData<NotificationsPage | undefined>({ queryKey: LIST_KEY }, (prev) => {
        if (!prev) return prev
        let flipped = false
        const items = prev.items.map((n) => {
          if (n.id !== id || n.readAt) return n
          flipped = true
          return { ...n, readAt: now }
        })
        if (!flipped) return prev
        return { ...prev, items, unread: Math.max(0, prev.unread - 1) }
      })
      queryClient.setQueryData<{ count: number } | undefined>(UNREAD_KEY, (prev) =>
        prev ? { count: Math.max(0, prev.count - 1) } : prev
      )
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
    },
    onSuccess: () => {
      // Re-sync silently to pick up server truth (e.g. emailSentAt updates).
      queryClient.invalidateQueries({ queryKey: UNREAD_KEY })
    },
  })

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] })
      const now = new Date().toISOString()
      queryClient.setQueriesData<NotificationsPage | undefined>({ queryKey: LIST_KEY }, (prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((n) => (n.readAt ? n : { ...n, readAt: now })),
              unread: 0,
            }
          : prev
      )
      queryClient.setQueryData<{ count: number }>(UNREAD_KEY, { count: 0 })
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
      toast.error("Couldn't mark all as read")
    },
    onSuccess: (res) => {
      if (res.updated > 0) toast.success(`Marked ${res.updated} as read`)
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
    },
  })

  const handleClick = (notification: Notification) => {
    setActiveNotification(notification)
    setOpen(false)
  }

  return (
    <>
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full border border-border text-foreground hover:bg-secondary hover:text-accent"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="text-sm font-semibold">Notifications</div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs text-foreground hover:text-foreground"
            disabled={unread === 0 || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark all
          </Button>
        </div>
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <label htmlFor="notif-unread-only" className="text-xs text-muted-foreground">
            Only unread
          </label>
          <Switch
            id="notif-unread-only"
            checked={unreadOnly}
            onCheckedChange={setUnreadOnly}
            className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4"
          />
        </div>
        {listQuery.isLoading ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : listQuery.isError ? (
          <div className="px-4 py-8 text-center text-sm text-destructive">
            Couldn't load notifications.
          </div>
        ) : parsedItems.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {unreadOnly ? "No unread notifications." : "You're all caught up."}
          </div>
        ) : (
          <ScrollArea className="max-h-[420px]">
            <ul className="divide-y divide-border">
              {parsedItems.map(({ notification, data }) => {
                const isUnread = !notification.readAt
                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => handleClick(notification)}
                      className={`flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/60 ${
                        isUnread ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        <KindIcon kind={notification.kind} data={data} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 break-all text-sm font-medium leading-snug">
                            {notification.title}
                          </div>
                          {isUnread && (
                            <Circle className="mt-1 h-2 w-2 shrink-0 fill-primary text-primary" />
                          )}
                        </div>
                        {notification.body && (
                          <p className="mt-0.5 line-clamp-2 break-words whitespace-pre-line text-xs text-muted-foreground">
                            {notification.body}
                          </p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{formatRelative(notification.createdAt)}</span>
                          {notification.kind === "CONTENT_RESOURCE_REVIEWED" && (
                            <Badge
                              variant={
                                (data as Partial<ResourceReviewedData> | null)?.resource
                                  ?.approvalState === "REJECTED"
                                  ? "destructive"
                                  : "success"
                              }
                              className="px-1.5 py-0 text-[9px] uppercase"
                            >
                              {(data as Partial<ResourceReviewedData> | null)?.resource
                                ?.approvalState ?? "REVIEWED"}
                            </Badge>
                          )}
                          {notification.kind === "CONTENT_RESOURCE_REQUESTED" && (
                            <Badge variant="warning" className="px-1.5 py-0 text-[9px] uppercase">
                              Approval needed
                            </Badge>
                          )}
                          {notification.kind === "CONTENT_NODE_READY" && (
                            <Badge variant="info" className="px-1.5 py-0 text-[9px] uppercase">
                              Ready
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </ScrollArea>
        )}
        {page && page.total > items.length && (
          <div className="border-t border-border px-3 py-2 text-center text-[11px] text-muted-foreground">
            Showing {items.length} of {page.total}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>

    <NotificationDetailDialog
      notification={activeNotification}
      open={Boolean(activeNotification)}
      onOpenChange={(isOpen) => {
        if (!isOpen) setActiveNotification(null)
      }}
      onMarkRead={(id) => markRead.mutate(id)}
    />
    </>
  )
}
