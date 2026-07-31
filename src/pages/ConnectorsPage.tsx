import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { gmailApi, meetingsApi } from "@/lib/api"
import type {
  CalendarStatus,
  GmailMessage,
  GmailStatus,
  Meeting,
  MeetingStatus,
} from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import {
  Calendar,
  ChevronDown,
  ExternalLink,
  Loader2,
  Mail,
  RefreshCw,
  Unplug,
  Video,
} from "lucide-react"
import { cn } from "@/lib/utils"

const ACTIVE_STATUSES: MeetingStatus[] = ["JOINING", "RECORDING", "PROCESSING"]

const STATUS_CONFIG: Record<
  MeetingStatus,
  { label: string; className: string; pulse?: boolean }
> = {
  SCHEDULED: {
    label: "Scheduled",
    className:
      "border-slate-700/20 bg-slate-500/15 text-slate-800 dark:border-transparent dark:bg-slate-600/20 dark:text-slate-300",
  },
  JOINING: {
    label: "Joining",
    className:
      "border-blue-700/20 bg-blue-500/15 text-blue-800 dark:border-transparent dark:bg-blue-600/20 dark:text-blue-400",
  },
  RECORDING: {
    label: "Recording",
    pulse: true,
    className:
      "border-red-700/25 bg-red-500/15 text-red-800 dark:border-transparent dark:bg-red-600/20 dark:text-red-400",
  },
  PROCESSING: {
    label: "Processing",
    className:
      "border-amber-700/25 bg-amber-500/20 text-amber-800 dark:border-transparent dark:bg-amber-600/20 dark:text-amber-400",
  },
  COMPLETED: {
    label: "Done",
    className:
      "border-emerald-700/20 bg-emerald-500/15 text-emerald-800 dark:border-transparent dark:bg-emerald-600/20 dark:text-emerald-400",
  },
  FAILED: {
    label: "Failed",
    className:
      "border-red-700/25 bg-red-500/15 text-red-800 dark:border-transparent dark:bg-red-600/20 dark:text-red-400",
  },
  CANCELLED: {
    label: "Cancelled",
    className:
      "border-slate-700/20 bg-slate-500/15 text-slate-800 dark:border-transparent dark:bg-slate-600/20 dark:text-slate-300",
  },
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso))
}

function isMeetUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim())
    return parsed.hostname === "meet.google.com" || parsed.hostname.endsWith(".meet.google.com")
  } catch {
    return url.includes("meet.google.com")
  }
}

function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: "border-border/70 bg-card/55 text-muted-foreground",
  }
  return (
    <Badge
      variant="outline"
      className={cn(config.className, config.pulse && "animate-pulse")}
      title={status}
    >
      {config.label}
    </Badge>
  )
}

function ReadBadge({ isRead }: { isRead: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        isRead
          ? "border-slate-700/20 bg-slate-500/15 text-slate-800 dark:border-transparent dark:bg-slate-600/20 dark:text-slate-300"
          : "border-blue-700/20 bg-blue-500/15 text-blue-800 dark:border-transparent dark:bg-blue-600/20 dark:text-blue-400"
      )}
    >
      {isRead ? "Read" : "Unread"}
    </Badge>
  )
}

function MessagePreview({ message, expanded }: { message: GmailMessage; expanded: boolean }) {
  const preview = message.snippet || message.bodyText || "—"
  if (!expanded) {
    return <p className="truncate text-xs text-muted-foreground">{message.snippet || "—"}</p>
  }
  return <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{preview}</p>
}

type ConnectorTab = "meet" | "gmail"

export default function ConnectorsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<ConnectorTab>("meet")

  // —— Google Meet / Calendar ——
  const [calendar, setCalendar] = useState<CalendarStatus | null>(null)
  const [calendarLoading, setCalendarLoading] = useState(true)
  const [calendarConnecting, setCalendarConnecting] = useState(false)
  const [calendarDisconnecting, setCalendarDisconnecting] = useState(false)
  const [calendarSyncing, setCalendarSyncing] = useState(false)

  const [joinOpen, setJoinOpen] = useState(true)
  const [meetingUrl, setMeetingUrl] = useState("")
  const [meetingTitle, setMeetingTitle] = useState("")
  const [joining, setJoining] = useState(false)

  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [meetingsLoading, setMeetingsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<"all" | "COMPLETED">("all")
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null)

  // —— Gmail ——
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null)
  const [gmailStatusLoading, setGmailStatusLoading] = useState(true)
  const [gmailConnecting, setGmailConnecting] = useState(false)
  const [gmailDisconnecting, setGmailDisconnecting] = useState(false)
  const [gmailSyncing, setGmailSyncing] = useState(false)

  const [messages, setMessages] = useState<GmailMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [activeQuery, setActiveQuery] = useState("")
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null)

  const hasActiveMeetings = useMemo(
    () => meetings.some((m) => ACTIVE_STATUSES.includes(m.status)),
    [meetings]
  )

  const fetchCalendar = useCallback(async () => {
    setCalendarLoading(true)
    try {
      setCalendar(await meetingsApi.calendarStatus())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load calendar status")
      setCalendar({ connected: false })
    } finally {
      setCalendarLoading(false)
    }
  }, [])

  const fetchMeetings = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setMeetingsLoading(true)
      try {
        const params: { limit: number; status?: MeetingStatus } = { limit: 50 }
        if (statusFilter === "COMPLETED") params.status = "COMPLETED"
        const list = await meetingsApi.list(params)
        setMeetings(Array.isArray(list) ? list : [])
      } catch (err) {
        if (!opts?.silent) {
          toast.error(err instanceof Error ? err.message : "Failed to load meetings")
        }
      } finally {
        if (!opts?.silent) setMeetingsLoading(false)
      }
    },
    [statusFilter]
  )

  const fetchGmailStatus = useCallback(async () => {
    setGmailStatusLoading(true)
    try {
      setGmailStatus(await gmailApi.status())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load Gmail status")
      setGmailStatus({ connected: false, status: "DISCONNECTED" })
    } finally {
      setGmailStatusLoading(false)
    }
  }, [])

  const fetchMessages = useCallback(async (opts?: { silent?: boolean; q?: string }) => {
    if (!opts?.silent) setMessagesLoading(true)
    try {
      const q = opts?.q?.trim()
      const list = await gmailApi.listMessages({
        limit: 50,
        ...(q ? { q } : {}),
      })
      setMessages(Array.isArray(list) ? list : [])
      setMessagesError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load messages"
      setMessagesError(message)
      if (!opts?.silent) toast.error(message)
    } finally {
      if (!opts?.silent) setMessagesLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchCalendar()
    void fetchGmailStatus()
  }, [fetchCalendar, fetchGmailStatus])

  useEffect(() => {
    void fetchMeetings()
  }, [fetchMeetings])

  useEffect(() => {
    void fetchMessages({ q: activeQuery || undefined })
  }, [fetchMessages, activeQuery])

  useEffect(() => {
    const calendarParam = searchParams.get("calendar")
    const gmailParam = searchParams.get("gmail")
    if (!calendarParam && !gmailParam) return

    if (calendarParam) {
      setTab("meet")
      if (calendarParam === "connected") {
        toast.success("Google Calendar connected! Bran will auto-join your Meet calls.")
        void fetchCalendar()
      } else if (calendarParam === "error") {
        const message = searchParams.get("message")
        const decoded = message ? decodeURIComponent(message) : "Failed to connect Google Calendar"
        const isAccessDenied = /access.?denied|access.?blocked|403/i.test(decoded)
        toast.error(
          isAccessDenied
            ? `${decoded}. If the Google OAuth app is in Testing mode, your email must be added as a test user in Google Cloud Console.`
            : decoded
        )
      }
    }

    if (gmailParam) {
      setTab("gmail")
      if (gmailParam === "connected") {
        toast.success("Gmail connected. Bran is syncing your recent mail.")
        void fetchGmailStatus()
        void fetchMessages()
      } else if (gmailParam === "error") {
        const message = searchParams.get("message")
        const decoded = message ? decodeURIComponent(message) : "Failed to connect Gmail"
        const isAccessDenied = /access.?denied|access.?blocked|403/i.test(decoded)
        toast.error(
          isAccessDenied
            ? `${decoded}. If the Google OAuth app is in Testing mode, your email must be added as a test user in Google Cloud Console.`
            : decoded
        )
      }
    }

    const next = new URLSearchParams(searchParams)
    next.delete("calendar")
    next.delete("gmail")
    next.delete("message")
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, fetchCalendar, fetchGmailStatus, fetchMessages])

  useEffect(() => {
    if (!hasActiveMeetings) return
    const id = window.setInterval(() => {
      void fetchMeetings({ silent: true })
    }, 30_000)
    return () => window.clearInterval(id)
  }, [fetchMeetings, hasActiveMeetings])

  const handleConnectCalendar = async () => {
    setCalendarConnecting(true)
    try {
      const { authorizationUrl } = await meetingsApi.connectCalendar()
      window.location.href = authorizationUrl
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start calendar connect")
      setCalendarConnecting(false)
    }
  }

  const handleDisconnectCalendar = async () => {
    setCalendarDisconnecting(true)
    try {
      await meetingsApi.disconnectCalendar()
      setCalendar({ connected: false, status: "DISCONNECTED" })
      toast.success("Calendar disconnected")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect calendar")
    } finally {
      setCalendarDisconnecting(false)
    }
  }

  const handleSyncCalendar = async () => {
    setCalendarSyncing(true)
    try {
      const result = await meetingsApi.syncCalendar()
      setMeetings(Array.isArray(result.meetings) ? result.meetings : [])
      toast.success("Upcoming Meet calls synced — Bran Notetaker will auto-join them.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sync calendar")
    } finally {
      setCalendarSyncing(false)
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    const url = meetingUrl.trim()
    if (!url) {
      toast.error("Meeting URL is required")
      return
    }
    if (!isMeetUrl(url)) {
      toast.error("Only Google Meet URLs (meet.google.com) are supported")
      return
    }

    setJoining(true)
    try {
      await meetingsApi.join({
        meetingUrl: url,
        title: meetingTitle.trim() || undefined,
      })
      setMeetingUrl("")
      setMeetingTitle("")
      toast.success("Bran Notetaker is joining — admit the bot if Meet asks.")
      window.open(url, "_blank", "noopener,noreferrer")
      await fetchMeetings()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join meeting")
    } finally {
      setJoining(false)
    }
  }

  const handleConnectGmail = async () => {
    setGmailConnecting(true)
    try {
      const { authorizationUrl } = await gmailApi.connect()
      if (!authorizationUrl) throw new Error("No authorization URL returned")
      window.location.href = authorizationUrl
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start Gmail connect")
      setGmailConnecting(false)
    }
  }

  const handleDisconnectGmail = async () => {
    setGmailDisconnecting(true)
    try {
      await gmailApi.disconnect()
      setGmailStatus({ connected: false, status: "DISCONNECTED" })
      setMessages([])
      toast.success("Gmail disconnected")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect Gmail")
    } finally {
      setGmailDisconnecting(false)
    }
  }

  const handleSyncGmail = async () => {
    setGmailSyncing(true)
    try {
      const result = await gmailApi.sync()
      setMessages(Array.isArray(result.messages) ? result.messages : [])
      setActiveQuery("")
      setQuery("")
      toast.success(`Synced ${result.synced} message${result.synced === 1 ? "" : "s"}`)
      void fetchGmailStatus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sync Gmail")
      void fetchGmailStatus()
    } finally {
      setGmailSyncing(false)
    }
  }

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault()
    setActiveQuery(query.trim())
  }

  const calendarError = calendar?.status === "ERROR"
  const gmailError = gmailStatus?.status === "ERROR"
  const gmailConnected = Boolean(gmailStatus?.connected) || gmailError

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-brand text-2xl tracking-wide text-accent">Connectors</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect Google Meet (Calendar) and Gmail so Bran can join calls, sync mail, and turn
          activity into work.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              Google Calendar / Meet
            </CardTitle>
            <CardDescription>
              Separate from Google Sign-In. Bran only reads calendar events. The bot joins as{" "}
              <span className="font-medium text-foreground">Bran Notetaker</span>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {calendarLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-9 w-40" />
              </div>
            ) : calendarError ? (
              <div className="flex flex-col gap-3">
                <Badge
                  variant="outline"
                  className="w-fit border-red-700/25 bg-red-500/15 text-red-800 dark:text-red-400"
                >
                  Calendar connection error
                  {calendar?.oauthEmail ? ` (${calendar.oauthEmail})` : ""}
                </Badge>
                <Button onClick={handleConnectCalendar} disabled={calendarConnecting}>
                  {calendarConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Calendar className="h-4 w-4" />
                  )}
                  Reconnect
                </Button>
              </div>
            ) : calendar?.connected ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Badge
                    variant="outline"
                    className="w-fit border-emerald-700/20 bg-emerald-500/15 text-emerald-800 dark:text-emerald-400"
                  >
                    Calendar connected
                    {calendar.oauthEmail ? ` (${calendar.oauthEmail})` : ""}
                  </Badge>
                  {calendar.connectedAt && (
                    <p className="text-xs text-muted-foreground">
                      Connected {formatDateTime(calendar.connectedAt)}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncCalendar}
                    disabled={calendarSyncing}
                  >
                    {calendarSyncing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Video className="h-4 w-4" />
                    )}
                    Sync Meet calls
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnectCalendar}
                    disabled={calendarDisconnecting}
                  >
                    {calendarDisconnecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Unplug className="h-4 w-4" />
                    )}
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Connect Calendar so Bran can auto-join Google Meet calls and create work units
                  from action items.
                </p>
                <Button onClick={handleConnectCalendar} disabled={calendarConnecting}>
                  {calendarConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Calendar className="h-4 w-4" />
                  )}
                  Connect Google Calendar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5 text-muted-foreground" />
              Gmail
            </CardTitle>
            <CardDescription>
              Read-only inbox sync. Tokens are encrypted server-side. Background sync about every 5
              minutes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {gmailStatusLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-9 w-40" />
              </div>
            ) : gmailError ? (
              <div className="space-y-3">
                <Badge
                  variant="outline"
                  className="w-fit border-red-700/25 bg-red-500/15 text-red-800 dark:border-transparent dark:bg-red-600/20 dark:text-red-400"
                >
                  Gmail connection error
                  {gmailStatus?.oauthEmail ? ` (${gmailStatus.oauthEmail})` : ""}
                </Badge>
                {gmailStatus?.errorMessage && (
                  <p className="text-sm text-destructive">{gmailStatus.errorMessage}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={handleSyncGmail} disabled={gmailSyncing}>
                    {gmailSyncing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Sync now
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnectGmail}
                    disabled={gmailDisconnecting}
                  >
                    {gmailDisconnecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Unplug className="h-4 w-4" />
                    )}
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : gmailConnected ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Badge
                    variant="outline"
                    className="w-fit border-emerald-700/20 bg-emerald-500/15 text-emerald-800 dark:border-transparent dark:bg-emerald-600/20 dark:text-emerald-400"
                  >
                    Gmail connected
                    {gmailStatus?.oauthEmail ? ` (${gmailStatus.oauthEmail})` : ""}
                  </Badge>
                  {gmailStatus?.connectedAt && (
                    <p className="text-xs text-muted-foreground">
                      Connected {formatDateTime(gmailStatus.connectedAt)}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Last synced {formatDateTime(gmailStatus?.lastSyncedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncGmail}
                    disabled={gmailSyncing}
                  >
                    {gmailSyncing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Sync now
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnectGmail}
                    disabled={gmailDisconnecting}
                  >
                    {gmailDisconnecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Unplug className="h-4 w-4" />
                    )}
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Connect Gmail to sync recent messages. First sync pulls up to 50 from the last 7
                  days.
                </p>
                <Button onClick={handleConnectGmail} disabled={gmailConnecting}>
                  {gmailConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  Connect Gmail
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as ConnectorTab)}>
        <TabsList>
          <TabsTrigger value="meet" className="gap-2">
            <Video className="h-4 w-4" />
            Google Meet
          </TabsTrigger>
          <TabsTrigger value="gmail" className="gap-2">
            <Mail className="h-4 w-4" />
            Gmail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="meet" className="mt-4 space-y-6">
          <Card>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 p-5 text-left sm:p-6"
              onClick={() => setJoinOpen((open) => !open)}
              aria-expanded={joinOpen}
            >
              <div>
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <Video className="h-5 w-5 text-muted-foreground" />
                  Join a meeting now
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Paste a Google Meet link and click{" "}
                  <span className="font-medium text-foreground">Send Bran Notetaker</span>.
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
                  joinOpen && "rotate-180"
                )}
              />
            </button>
            {joinOpen && (
              <CardContent className="border-t border-border/50 pt-5">
                <form className="space-y-4" onSubmit={handleJoin}>
                  <div className="space-y-2">
                    <Label htmlFor="meeting-url">Meeting URL</Label>
                    <Input
                      id="meeting-url"
                      placeholder="https://meet.google.com/abc-defg-hij"
                      value={meetingUrl}
                      onChange={(e) => setMeetingUrl(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="meeting-title">Title (optional)</Label>
                    <Input
                      id="meeting-title"
                      placeholder="Weekly standup"
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={joining}>
                    {joining ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Video className="h-4 w-4" />
                    )}
                    Send Bran Notetaker
                  </Button>
                </form>
              </CardContent>
            )}
          </Card>

          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold">Your meetings</h2>
              <div className="filter-chip-row sm:flex-wrap sm:overflow-visible">
                <Button
                  size="sm"
                  variant={statusFilter === "all" ? "default" : "outline"}
                  onClick={() => setStatusFilter("all")}
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === "COMPLETED" ? "default" : "outline"}
                  onClick={() => setStatusFilter("COMPLETED")}
                >
                  Completed
                </Button>
              </div>
            </div>

            {meetingsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : meetings.length === 0 ? (
              <p className="rounded-lg border border-border/70 bg-card/40 p-8 text-center text-sm text-muted-foreground">
                No meetings yet. Connect your calendar or join a Meet link above.
              </p>
            ) : (
              <>
                <div className="data-card-list flex flex-col lg:hidden">
                  {meetings.map((meeting) => (
                    <div
                      key={meeting.id}
                      className="space-y-2 rounded-xl border border-border/70 bg-card/60 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {meeting.title || meeting.meetingUrl}
                          </p>
                          <a
                            href={meeting.meetingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate text-xs text-muted-foreground underline-offset-2 hover:underline"
                          >
                            {meeting.meetingUrl}
                          </a>
                        </div>
                        <MeetingStatusBadge status={meeting.status} />
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Start: {formatDateTime(meeting.startTime)}</span>
                        <span>Created: {formatDateTime(meeting.createdAt)}</span>
                      </div>
                      {meeting.status === "FAILED" && meeting.errorMessage && (
                        <p className="text-xs text-destructive">{meeting.errorMessage}</p>
                      )}
                      {meeting.status === "COMPLETED" && meeting.voiceRecordingId && (
                        <Button asChild variant="outline" size="sm" className="h-8">
                          <Link
                            to={`/work?recording=${encodeURIComponent(meeting.voiceRecordingId)}`}
                          >
                            View work units from this meeting
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="data-table-shell hidden rounded-lg border border-border/70 lg:block">
                  <Table className="min-w-[720px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Start time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Work units</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {meetings.map((meeting) => (
                        <TableRow key={meeting.id}>
                          <TableCell>
                            <div className="min-w-0 max-w-xs">
                              <p className="truncate font-medium">
                                {meeting.title || meeting.meetingUrl}
                              </p>
                              <a
                                href={meeting.meetingUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="truncate text-xs text-muted-foreground underline-offset-2 hover:underline"
                                title="Opens Google Meet in your browser only — does not send Bran Notetaker"
                              >
                                Open link (you only)
                              </a>
                              {meeting.status === "FAILED" && meeting.errorMessage && (
                                <button
                                  type="button"
                                  className="mt-1 block text-left text-xs text-destructive underline-offset-2 hover:underline"
                                  onClick={() =>
                                    setExpandedErrorId((id) =>
                                      id === meeting.id ? null : meeting.id
                                    )
                                  }
                                >
                                  {expandedErrorId === meeting.id
                                    ? meeting.errorMessage
                                    : "Show error"}
                                </button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {formatDateTime(meeting.startTime)}
                          </TableCell>
                          <TableCell>
                            <MeetingStatusBadge status={meeting.status} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {formatDateTime(meeting.createdAt)}
                          </TableCell>
                          <TableCell>
                            {meeting.status === "COMPLETED" && meeting.voiceRecordingId ? (
                              <Button asChild variant="ghost" size="sm" className="h-8 px-2">
                                <Link
                                  to={`/work?recording=${encodeURIComponent(meeting.voiceRecordingId)}`}
                                >
                                  View work units
                                </Link>
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="gmail" className="mt-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">Your messages</h2>
            <form
              className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"
              onSubmit={handleSearch}
            >
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search subject, from, snippet…"
                className="sm:w-64"
              />
              <Button type="submit" size="sm" variant="outline" disabled={messagesLoading}>
                Search
              </Button>
            </form>
          </div>

          {messagesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : messagesError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center text-sm text-destructive">
              {messagesError}
            </p>
          ) : messages.length === 0 ? (
            <p className="rounded-lg border border-border/70 bg-card/40 p-8 text-center text-sm text-muted-foreground">
              {gmailConnected
                ? activeQuery
                  ? `No messages match “${activeQuery}”.`
                  : "No synced messages yet. Connect Gmail or click Sync now."
                : "No messages yet. Connect Gmail above to start syncing."}
            </p>
          ) : (
            <>
              <div className="data-card-list flex flex-col lg:hidden">
                {messages.map((message) => {
                  const expanded = expandedMessageId === message.id
                  return (
                    <button
                      key={message.id}
                      type="button"
                      className="space-y-2 rounded-xl border border-border/70 bg-card/60 p-3 text-left"
                      onClick={() =>
                        setExpandedMessageId((id) => (id === message.id ? null : message.id))
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {message.subject || "(no subject)"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {message.fromAddress || "—"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <ReadBadge isRead={message.isRead} />
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 text-muted-foreground transition-transform",
                              expanded && "rotate-180"
                            )}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Received: {formatDateTime(message.receivedAt)}
                      </p>
                      <MessagePreview message={message} expanded={expanded} />
                    </button>
                  )
                })}
              </div>

              <div className="data-table-shell hidden rounded-lg border border-border/70 lg:block">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>From</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Read/Unread</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.map((message) => {
                      const expanded = expandedMessageId === message.id
                      return (
                        <TableRow
                          key={message.id}
                          className="cursor-pointer"
                          onClick={() =>
                            setExpandedMessageId((id) => (id === message.id ? null : message.id))
                          }
                        >
                          <TableCell className="max-w-[200px] truncate text-sm">
                            {message.fromAddress || "—"}
                          </TableCell>
                          <TableCell className="max-w-[360px]">
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">
                                  {message.subject || "(no subject)"}
                                </p>
                                <MessagePreview message={message} expanded={expanded} />
                              </div>
                              <ChevronDown
                                className={cn(
                                  "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                                  expanded && "rotate-180"
                                )}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {formatDateTime(message.receivedAt)}
                          </TableCell>
                          <TableCell>
                            <ReadBadge isRead={message.isRead} />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
