import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { meetingsApi } from "@/lib/api"
import type { CalendarStatus, Meeting, MeetingStatus } from "@/types"
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
import { toast } from "sonner"
import {
  Calendar,
  ChevronDown,
  ExternalLink,
  Loader2,
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

export default function MeetingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [calendar, setCalendar] = useState<CalendarStatus | null>(null)
  const [calendarLoading, setCalendarLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const [joinOpen, setJoinOpen] = useState(true)
  const [meetingUrl, setMeetingUrl] = useState("")
  const [meetingTitle, setMeetingTitle] = useState("")
  const [joining, setJoining] = useState(false)

  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [meetingsLoading, setMeetingsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<"all" | "COMPLETED">("all")
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null)

  const hasActiveMeetings = useMemo(
    () => meetings.some((m) => ACTIVE_STATUSES.includes(m.status)),
    [meetings]
  )

  const fetchCalendar = useCallback(async () => {
    setCalendarLoading(true)
    try {
      const status = await meetingsApi.calendarStatus()
      setCalendar(status)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load calendar status")
      setCalendar({ connected: false })
    } finally {
      setCalendarLoading(false)
    }
  }, [])

  const fetchMeetings = useCallback(async (opts?: { silent?: boolean }) => {
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
  }, [statusFilter])

  useEffect(() => {
    fetchCalendar()
  }, [fetchCalendar])

  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  useEffect(() => {
    const calendarParam = searchParams.get("calendar")
    if (!calendarParam) return

    if (calendarParam === "connected") {
      toast.success("Google Calendar connected! Bran will auto-join your Meet calls.")
      fetchCalendar()
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

    const next = new URLSearchParams(searchParams)
    next.delete("calendar")
    next.delete("message")
    setSearchParams(next, { replace: true })
  }, [fetchCalendar, searchParams, setSearchParams])

  useEffect(() => {
    if (!hasActiveMeetings) return
    const id = window.setInterval(() => {
      fetchMeetings({ silent: true })
    }, 30_000)
    return () => window.clearInterval(id)
  }, [fetchMeetings, hasActiveMeetings])

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const { authorizationUrl } = await meetingsApi.connectCalendar()
      window.location.href = authorizationUrl
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start calendar connect")
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await meetingsApi.disconnectCalendar()
      setCalendar({ connected: false, status: "DISCONNECTED" })
      toast.success("Calendar disconnected")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect calendar")
    } finally {
      setDisconnecting(false)
    }
  }

  const handleSyncCalendar = async () => {
    setSyncing(true)
    try {
      const result = await meetingsApi.syncCalendar()
      setMeetings(Array.isArray(result.meetings) ? result.meetings : [])
      toast.success("Upcoming Meet calls synced — Bran Notetaker will auto-join them.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sync calendar")
    } finally {
      setSyncing(false)
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
      // Open the call for you; the API above is what actually sends the bot.
      window.open(url, "_blank", "noopener,noreferrer")
      await fetchMeetings()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join meeting")
    } finally {
      setJoining(false)
    }
  }

  const calendarError = calendar?.status === "ERROR"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-brand text-2xl tracking-wide text-accent">Meetings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect Google Calendar so Bran Notetaker can join Meet calls, record them, and create work
          units from action items.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            Google Calendar
          </CardTitle>
          <CardDescription>
            Calendar connect is separate from Google Sign-In. Bran only reads calendar events — it
            cannot edit your calendar. The bot joins as a visible participant named{" "}
            <span className="font-medium text-foreground">Bran Notetaker</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {calendarLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full max-w-md" />
              <Skeleton className="h-9 w-48" />
            </div>
          ) : calendarError ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Badge
                variant="outline"
                className="w-fit border-red-700/25 bg-red-500/15 text-red-800 dark:text-red-400"
              >
                Calendar connection error
                {calendar?.oauthEmail ? ` (${calendar.oauthEmail})` : ""}
              </Badge>
              <Button onClick={handleConnect} disabled={connecting}>
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                Reconnect
              </Button>
            </div>
          ) : calendar?.connected ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                <Button variant="outline" onClick={handleSyncCalendar} disabled={syncing}>
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Video className="h-4 w-4" />
                  )}
                  Sync upcoming Meet calls
                </Button>
                <Button variant="outline" onClick={handleDisconnect} disabled={disconnecting}>
                  {disconnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Unplug className="h-4 w-4" />
                  )}
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your Google Calendar so Bran can automatically join your Google Meet calls,
                record them, and create work units from action items discussed in the meeting. Bran
                only reads calendar events — it cannot edit your calendar.
              </p>
              <Button onClick={handleConnect} disabled={connecting}>
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                Connect Google Calendar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
              Paste a Google Meet link and click <span className="font-medium text-foreground">Send Bran Notetaker</span>.
              “Open Meet” in the list only opens the link in your browser — it does not send the bot.
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
                {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                Send Bran Notetaker
              </Button>
            </form>
          </CardContent>
        )}
      </Card>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Your meetings</h2>
          <div className="flex flex-wrap gap-2">
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
            <div className="space-y-3 md:hidden">
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
                      <Link to={`/work?recording=${encodeURIComponent(meeting.voiceRecordingId)}`}>
                        View work units from this meeting
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-lg border border-border/70 md:block">
              <Table>
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
    </div>
  )
}
