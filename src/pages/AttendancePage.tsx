import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { etaApi } from "@/lib/api"
import {
  canManageEta,
  type EtaBadge,
  type EtaEntry,
  type EtaListData,
  type EtaMember,
  type EtaPod,
  type EtaSummary,
} from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { Bell, Loader2, RefreshCw, Search, Users } from "lucide-react"
import { cn } from "@/lib/utils"

const EMPTY_SUMMARY: EtaSummary = {
  total: 0,
  submitted: 0,
  missing: 0,
  wfh: 0,
  leave: 0,
  compOff: 0,
  office: 0,
}

function todayIst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function formatIstDateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number)
  if (!y || !m || !d) return date
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d, 6, 0, 0)))
}

function formatIstDateTime(iso: string | null): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso))
}

const BADGE_CONFIG: Record<
  EtaBadge,
  { label: string; className: string; variant?: "outline" | "secondary" }
> = {
  on_time: {
    label: "On time",
    className:
      "border-emerald-700/20 bg-emerald-500/15 text-emerald-800 dark:border-transparent dark:bg-emerald-600/20 dark:text-emerald-400",
  },
  late_submission: {
    label: "Late submission",
    className:
      "border-amber-700/25 bg-amber-500/20 text-amber-800 dark:border-transparent dark:bg-amber-600/20 dark:text-amber-400",
  },
  late_arrival: {
    label: "Late arrival",
    className:
      "border-red-700/25 bg-red-500/15 text-red-800 dark:border-transparent dark:bg-red-600/20 dark:text-red-400",
  },
  wfh: {
    label: "WFH",
    className:
      "border-blue-700/20 bg-blue-500/15 text-blue-800 dark:border-transparent dark:bg-blue-600/20 dark:text-blue-400",
  },
  leave: {
    label: "Leave",
    className:
      "border-purple-700/20 bg-purple-500/15 text-purple-800 dark:border-transparent dark:bg-purple-600/20 dark:text-purple-400",
  },
  comp_off: {
    label: "Comp Off",
    className:
      "border-slate-700/20 bg-slate-500/15 text-slate-800 dark:border-transparent dark:bg-slate-600/20 dark:text-slate-300",
  },
  missing: {
    label: "Missing",
    variant: "outline",
    className:
      "border-red-700/40 bg-transparent text-red-700 dark:border-red-500/50 dark:text-red-400",
  },
  submitted: {
    label: "Submitted",
    variant: "secondary",
    className: "",
  },
}

function EtaBadgePill({ badge }: { badge: EtaBadge }) {
  const config = BADGE_CONFIG[badge]
  return (
    <Badge variant={config.variant ?? "outline"} className={cn(config.className)}>
      {config.label}
    </Badge>
  )
}

function recordTypeLabel(type: EtaEntry["recordType"]): string {
  if (!type) return "—"
  if (type === "comp_off") return "Comp off"
  if (type === "wfh") return "WFH"
  return type.charAt(0).toUpperCase() + type.slice(1)
}

const SUMMARY_CHIPS: Array<{ key: keyof EtaSummary; label: string }> = [
  { key: "total", label: "Total" },
  { key: "submitted", label: "Submitted" },
  { key: "missing", label: "Missing" },
  { key: "office", label: "Office" },
  { key: "wfh", label: "WFH" },
  { key: "leave", label: "Leave" },
  { key: "compOff", label: "Comp off" },
]

export default function AttendancePage() {
  const { user } = useAuth()
  const isAdmin = canManageEta(user)

  const [date, setDate] = useState(todayIst)
  const [data, setData] = useState<EtaListData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [checking, setChecking] = useState(false)
  const [reminding, setReminding] = useState(false)
  const [remindConfirmOpen, setRemindConfirmOpen] = useState(false)

  const [membersOpen, setMembersOpen] = useState(false)
  const [members, setMembers] = useState<EtaMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersQuery, setMembersQuery] = useState("")
  const [updatingPodId, setUpdatingPodId] = useState<string | null>(null)

  const summary = data?.summary ?? EMPTY_SUMMARY
  const entries = data?.entries ?? []

  const filteredMembers = useMemo(() => {
    const q = membersQuery.trim().toLowerCase()
    if (!q) return members
    return members.filter((m) => {
      const haystack = [m.realName, m.name, m.email].filter(Boolean).join(" ").toLowerCase()
      return haystack.includes(q)
    })
  }, [members, membersQuery])

  const fetchList = useCallback(async (selectedDate: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await etaApi.list({ date: selectedDate })
      setData(res)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load attendance"
      setError(message)
      setData(null)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList(date)
  }, [date, fetchList])

  const handleCheck = async () => {
    setChecking(true)
    try {
      const res = await etaApi.check({ date, sendReminders: false })
      toast.success(
        res.weekend
          ? `Weekend — synced ${res.membersSynced} members, no missing checks`
          : `Check done — ${res.missingCreated} missing, ${res.history.recorded} recorded`
      )
      await fetchList(date)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to run check")
    } finally {
      setChecking(false)
    }
  }

  const handleRemind = async () => {
    setReminding(true)
    try {
      const res = await etaApi.remind({ date })
      toast.success(`Reminders — sent ${res.sent}, skipped ${res.skipped}`)
      setRemindConfirmOpen(false)
      await fetchList(date)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reminders")
    } finally {
      setReminding(false)
    }
  }

  const loadMembers = async () => {
    setMembersOpen(true)
    setMembersQuery("")
    setMembersLoading(true)
    try {
      const res = await etaApi.listMembers()
      setMembers(res)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load members")
      setMembersOpen(false)
    } finally {
      setMembersLoading(false)
    }
  }

  const togglePod = async (member: EtaMember) => {
    const next: EtaPod = member.pod === "production" ? "default" : "production"
    setUpdatingPodId(member.slackUserId)
    try {
      const res = await etaApi.updateMemberPod(member.slackUserId, next)
      setMembers((prev) =>
        prev.map((m) => (m.slackUserId === member.slackUserId ? { ...m, pod: res.pod } : m))
      )
      toast.success(
        `${member.realName || member.name} → ${res.pod === "production" ? "production" : "default"} pod`
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update pod")
    } finally {
      setUpdatingPodId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-brand text-2xl tracking-wide text-accent">Attendance</h1>
          <p className="mt-1 text-sm text-muted-foreground">{formatIstDateLabel(date)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            All times are IST. Submission deadline 11:00. Late arrival after 12:30.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            className="h-9 w-[150px]"
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value)
            }}
          />
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" disabled={checking || loading} onClick={handleCheck}>
                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Run Check
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={reminding || loading}
                onClick={() => setRemindConfirmOpen(true)}
              >
                {reminding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                Send Reminders
              </Button>
              <Button variant="outline" size="sm" onClick={loadMembers}>
                <Users className="h-4 w-4" />
                Members
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {SUMMARY_CHIPS.map(({ key, label }) => (
          <div
            key={key}
            className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/55 px-3 py-1.5 text-xs"
          >
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium tabular-nums">{summary[key]}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => fetchList(date)}>
            Retry
          </Button>
        </div>
      ) : entries.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">
          No attendance entries for this date.
        </p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-border/70 bg-card/60 p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{entry.userName}</p>
                    <p className="truncate text-xs text-muted-foreground">{entry.userEmail}</p>
                  </div>
                  <EtaBadgePill badge={entry.badge} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Type: {recordTypeLabel(entry.recordType)}</span>
                  <span>ETA: {entry.etaText || "—"}</span>
                  <span>Submitted: {formatIstDateTime(entry.submittedAt)}</span>
                  <span>Reminder: {entry.reminderSentAt ? formatIstDateTime(entry.reminderSentAt) : "—"}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto rounded-lg border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>ETA</TableHead>
                  <TableHead>Submitted at</TableHead>
                  <TableHead>Badge</TableHead>
                  <TableHead>Reminder sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.userName}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.userEmail}</TableCell>
                    <TableCell>{recordTypeLabel(entry.recordType)}</TableCell>
                    <TableCell className="tabular-nums">{entry.etaText || "—"}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatIstDateTime(entry.submittedAt)}
                    </TableCell>
                    <TableCell>
                      <EtaBadgePill badge={entry.badge} />
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {entry.reminderSentAt ? formatIstDateTime(entry.reminderSentAt) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <Dialog open={remindConfirmOpen} onOpenChange={(open) => !open && setRemindConfirmOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send reminders?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will DM people still missing attendance for {formatIstDateLabel(date)}. People who
            already received a reminder or are on the production pod are skipped.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemindConfirmOpen(false)} disabled={reminding}>
              Cancel
            </Button>
            <Button onClick={handleRemind} disabled={reminding}>
              {reminding ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send Reminders
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={membersOpen}
        onOpenChange={(open) => {
          if (!open) {
            setMembersOpen(false)
            setMembersQuery("")
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Slack members</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Production pod is exempt from the 11:00 missing check.
          </p>
          {!membersLoading && members.length > 0 && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-9"
                placeholder="Search by name or email…"
                value={membersQuery}
                onChange={(e) => setMembersQuery(e.target.value)}
                autoFocus
              />
            </div>
          )}
          {membersLoading ? (
            <div className="space-y-3 py-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No members synced yet.</p>
          ) : filteredMembers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No members match your search.</p>
          ) : (
            <div className="overflow-y-auto -mx-6 px-6 space-y-1 max-h-[55vh]">
              {filteredMembers.map((member) => (
                <div
                  key={member.slackUserId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{member.realName || member.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground w-[4.5rem] text-right">
                      {member.pod === "production" ? "production" : "default"}
                    </span>
                    <Switch
                      checked={member.pod === "production"}
                      disabled={updatingPodId === member.slackUserId}
                      onCheckedChange={() => togglePod(member)}
                      aria-label={`Toggle pod for ${member.realName || member.name}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
