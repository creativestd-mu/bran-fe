import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { etaApi } from "@/lib/api"
import {
  canManageEta,
  type EtaBadge,
  type EtaEntry,
  type EtaFilter,
  type EtaListData,
  type EtaMember,
  type EtaMonthCounts,
  type EtaPod,
  type EtaSummary,
  type EtaUserDetail,
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
import { Bell, Check, Loader2, Pencil, RefreshCw, Search, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { AttendanceSubNav } from "@/components/attendance/AttendanceSubNav"

const EMPTY_SUMMARY: EtaSummary = {
  total: 0,
  submitted: 0,
  missing: 0,
  wfh: 0,
  leave: 0,
  compOff: 0,
  office: 0,
}

const EMPTY_MONTH_COUNTS: EtaMonthCounts = { leave: 0, wfh: 0, missing: 0 }

const FILTER_STORAGE_KEY = "bran_attendance_filter"

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

function readStoredFilter(): EtaFilter {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY)
    if (
      raw === "total" ||
      raw === "submitted" ||
      raw === "missing" ||
      raw === "office" ||
      raw === "wfh" ||
      raw === "leave" ||
      raw === "compOff"
    ) {
      return raw
    }
  } catch {
    /* ignore */
  }
  return "total"
}

function monthCountsLabel(counts: EtaMonthCounts | null | undefined): string {
  const c = counts ?? EMPTY_MONTH_COUNTS
  const parts: string[] = []
  if (c.missing > 0) parts.push(`Missing ${c.missing}`)

  const wfhApproved = c.wfhApproved ?? 0
  const wfhDenied = c.wfhDenied ?? 0
  const wfhPending = c.wfhPending ?? 0
  const hasWfhBreakdown = c.wfhApproved != null || c.wfhDenied != null || c.wfhPending != null
  if (hasWfhBreakdown) {
    if (wfhApproved > 0) parts.push(`WFH approved ${wfhApproved}`)
    if (wfhDenied > 0) parts.push(`WFH denied ${wfhDenied}`)
    if (wfhPending > 0) parts.push(`WFH pending ${wfhPending}`)
  } else if (c.wfh > 0) {
    parts.push(`WFH ${c.wfh}`)
  }

  const leaveApproved = c.leaveApproved ?? 0
  const leaveDenied = c.leaveDenied ?? 0
  const leavePending = c.leavePending ?? 0
  const hasLeaveBreakdown =
    c.leaveApproved != null || c.leaveDenied != null || c.leavePending != null
  if (hasLeaveBreakdown) {
    if (leaveApproved > 0) parts.push(`Leave approved ${leaveApproved}`)
    if (leaveDenied > 0) parts.push(`Leave denied ${leaveDenied}`)
    if (leavePending > 0) parts.push(`Leave pending ${leavePending}`)
  } else if (c.leave > 0) {
    parts.push(`Leave ${c.leave}`)
  }

  return parts.length > 0 ? parts.join(" · ") : "—"
}

function formatEntryDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  if (!y || !m || !d) return isoDate
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d, 6, 0, 0)))
}

function StatChip({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: number
  tone?: "default" | "good" | "bad" | "warn"
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        tone === "good" &&
          "border-emerald-700/20 bg-emerald-500/10 dark:border-transparent dark:bg-emerald-600/15",
        tone === "bad" &&
          "border-red-700/20 bg-red-500/10 dark:border-transparent dark:bg-red-600/15",
        tone === "warn" &&
          "border-amber-700/20 bg-amber-500/10 dark:border-transparent dark:bg-amber-600/15",
        tone === "default" && "border-border/70 bg-card/55"
      )}
    >
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

type CountDraft = {
  wfhApproved: string
  wfhDenied: string
  wfhPending: string
  leaveApproved: string
  leaveDenied: string
  leavePending: string
  missing: string
  onTime: string
  lateSubmission: string
  lateArrival: string
}

function draftFromDetail(detail: EtaUserDetail): CountDraft {
  return {
    wfhApproved: String(detail.breakdown.wfh.approved),
    wfhDenied: String(detail.breakdown.wfh.denied),
    wfhPending: String(detail.breakdown.wfh.pending),
    leaveApproved: String(detail.breakdown.leave.approved),
    leaveDenied: String(detail.breakdown.leave.denied),
    leavePending: String(detail.breakdown.leave.pending),
    missing: String(detail.breakdown.missing),
    onTime: String(detail.breakdown.onTime),
    lateSubmission: String(detail.breakdown.lateSubmission),
    lateArrival: String(detail.breakdown.lateArrival),
  }
}

function parseDraftInt(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === "") return 0
  if (!/^\d+$/.test(trimmed)) return null
  return Number(trimmed)
}

function CountField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (next: string) => void
}) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <Input
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        className="h-9 tabular-nums"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

function HistoryList({
  title,
  items,
}: {
  title: string
  items: EtaEntry[]
}) {
  if (items.length === 0) return null
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
      <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border p-2">
        {items.map((entry) => (
          <div
            key={entry.id}
            className="flex items-start justify-between gap-2 border-b border-border/50 pb-2 last:border-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{formatEntryDate(entry.entryDate)}</p>
              <p className="truncate text-xs text-muted-foreground">
                {entry.rawMessage || entry.etaText || entry.recordType || "—"}
              </p>
            </div>
            <EtaBadgePill badge={entry.badge} />
          </div>
        ))}
      </div>
    </div>
  )
}

function isRemindableEntry(entry: EtaEntry): boolean {
  if (entry.reminderSentAt) return false
  if (entry.status === "missing") return true
  if (entry.recordType === "wfh" && entry.wfhApprovalState === "pending") return true
  if (entry.recordType === "leave" && entry.leaveApprovalState === "pending") return true
  return false
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
  wfh_pending: {
    label: "WFH pending",
    className:
      "border-amber-700/25 bg-amber-500/20 text-amber-800 dark:border-transparent dark:bg-amber-600/20 dark:text-amber-400",
  },
  wfh_approved: {
    label: "WFH approved",
    className:
      "border-emerald-700/20 bg-emerald-500/15 text-emerald-800 dark:border-transparent dark:bg-emerald-600/20 dark:text-emerald-400",
  },
  wfh_denied: {
    label: "WFH denied",
    className:
      "border-red-700/25 bg-red-500/15 text-red-800 dark:border-transparent dark:bg-red-600/20 dark:text-red-400",
  },
  leave: {
    label: "Leave",
    className:
      "border-purple-700/20 bg-purple-500/15 text-purple-800 dark:border-transparent dark:bg-purple-600/20 dark:text-purple-400",
  },
  leave_pending: {
    label: "Leave pending",
    className:
      "border-amber-700/25 bg-amber-500/20 text-amber-800 dark:border-transparent dark:bg-amber-600/20 dark:text-amber-400",
  },
  leave_approved: {
    label: "Leave approved",
    className:
      "border-emerald-700/20 bg-emerald-500/15 text-emerald-800 dark:border-transparent dark:bg-emerald-600/20 dark:text-emerald-400",
  },
  leave_denied: {
    label: "Leave denied",
    className:
      "border-red-700/25 bg-red-500/15 text-red-800 dark:border-transparent dark:bg-red-600/20 dark:text-red-400",
  },
  comp_off: {
    label: "Comp Off",
    className:
      "border-slate-700/20 bg-slate-500/15 text-slate-800 dark:border-transparent dark:bg-slate-600/20 dark:text-slate-300",
  },
  office: {
    label: "Office",
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

const FALLBACK_BADGE = {
  label: "Unknown",
  variant: "outline" as const,
  className: "",
}

function EtaBadgePill({ badge }: { badge: string | null | undefined }) {
  const config = (badge && BADGE_CONFIG[badge as EtaBadge]) || {
    ...FALLBACK_BADGE,
    label: badge ? badge.replace(/_/g, " ") : "Unknown",
  }
  return (
    <Badge variant={config.variant ?? "outline"} className={cn(config.className)}>
      {config.label}
    </Badge>
  )
}

const SUMMARY_CHIPS: Array<{ key: EtaFilter; label: string }> = [
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
  const [filter, setFilter] = useState<EtaFilter>(readStoredFilter)
  const [data, setData] = useState<EtaListData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [checking, setChecking] = useState(false)
  const [reminding, setReminding] = useState(false)
  const [remindingSlackUserId, setRemindingSlackUserId] = useState<string | null>(null)
  const [remindConfirmOpen, setRemindConfirmOpen] = useState(false)

  const [membersOpen, setMembersOpen] = useState(false)
  const [members, setMembers] = useState<EtaMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersQuery, setMembersQuery] = useState("")
  const [updatingPodId, setUpdatingPodId] = useState<string | null>(null)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<EtaUserDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [savingCounts, setSavingCounts] = useState(false)
  const [editCountsOpen, setEditCountsOpen] = useState(false)
  const [countDraft, setCountDraft] = useState<CountDraft | null>(null)

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

  const selectFilter = (key: EtaFilter) => {
    const next = filter === key && key !== "total" ? "total" : key
    setFilter(next)
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }

  const fetchList = useCallback(async (selectedDate: string, selectedFilter: EtaFilter) => {
    setLoading(true)
    setError(null)
    try {
      const res = await etaApi.list({ date: selectedDate, filter: selectedFilter })
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
    fetchList(date, filter)
  }, [date, filter, fetchList])

  const handleCheck = async () => {
    setChecking(true)
    try {
      const res = await etaApi.check({ date, sendReminders: false })
      toast.success(
        res.weekend
          ? `Weekend — synced ${res.membersSynced} members, no missing checks`
          : `Check done — ${res.missingCreated} missing, ${res.history.recorded} recorded`
      )
      await fetchList(date, filter)
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
      await fetchList(date, filter)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reminders")
    } finally {
      setReminding(false)
    }
  }

  const openUserDetail = async (slackUserId: string) => {
    if (!slackUserId || !isAdmin) return
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)
    try {
      const res = await etaApi.getUserDetail(slackUserId, { limit: 120 })
      setDetail(res)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load person detail")
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  const openEditCounts = () => {
    if (!detail) return
    setCountDraft(draftFromDetail(detail))
    setEditCountsOpen(true)
  }

  const handleSaveCounts = async () => {
    if (!detail?.stats.slackUserId || !countDraft) return
    const parsed = {
      wfhApproved: parseDraftInt(countDraft.wfhApproved),
      wfhDenied: parseDraftInt(countDraft.wfhDenied),
      wfhPending: parseDraftInt(countDraft.wfhPending),
      leaveApproved: parseDraftInt(countDraft.leaveApproved),
      leaveDenied: parseDraftInt(countDraft.leaveDenied),
      leavePending: parseDraftInt(countDraft.leavePending),
      missing: parseDraftInt(countDraft.missing),
      onTime: parseDraftInt(countDraft.onTime),
      lateSubmission: parseDraftInt(countDraft.lateSubmission),
      lateArrival: parseDraftInt(countDraft.lateArrival),
    }
    if (Object.values(parsed).some((v) => v == null)) {
      toast.error("Counters must be whole numbers ≥ 0")
      return
    }
    setSavingCounts(true)
    try {
      await etaApi.setCounts(detail.stats.slackUserId, {
        wfhApproved: parsed.wfhApproved!,
        wfhDenied: parsed.wfhDenied!,
        wfhPending: parsed.wfhPending!,
        leaveApproved: parsed.leaveApproved!,
        leaveDenied: parsed.leaveDenied!,
        leavePending: parsed.leavePending!,
        missing: parsed.missing!,
        onTime: parsed.onTime!,
        lateSubmission: parsed.lateSubmission!,
        lateArrival: parsed.lateArrival!,
      })
      toast.success("Counters updated — history kept")
      setEditCountsOpen(false)
      const refreshed = await etaApi.getUserDetail(detail.stats.slackUserId, { limit: 120 })
      setDetail(refreshed)
      await fetchList(date, filter)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update counters")
    } finally {
      setSavingCounts(false)
    }
  }

  const handleRemindOne = async (entry: { slackUserId: string; userName: string }) => {
    if (!entry.slackUserId) return
    setRemindingSlackUserId(entry.slackUserId)
    try {
      const res = await etaApi.remind({ date, slackUserId: entry.slackUserId })
      if (res.sent > 0) {
        toast.success(`Reminder sent to ${entry.userName}`)
      } else {
        toast.message(`Reminder skipped for ${entry.userName}`)
      }
      await fetchList(date, filter)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reminder")
    } finally {
      setRemindingSlackUserId(null)
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
    <div className="min-w-0 space-y-6">
      <div className="page-header">
        <div className="min-w-0">
          <h1 className="font-brand text-2xl tracking-wide text-accent sm:text-3xl">Attendance</h1>
          <p className="mt-1 text-sm text-muted-foreground">{formatIstDateLabel(date)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            All times are IST. Submission deadline 11:00. Late arrival after 12:30.
          </p>
        </div>
        <div className="page-toolbar">
          <Input
            type="date"
            className="h-9 w-[150px] shrink-0"
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

      <AttendanceSubNav />

      <div className="filter-chip-row">
        {SUMMARY_CHIPS.map(({ key, label }) => {
          const active = filter === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => selectFilter(key)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors",
                active
                  ? "border-primary/50 bg-primary/15 text-foreground"
                  : "border-border/70 bg-card/55 hover:border-border hover:bg-card/80"
              )}
            >
              <span className={cn(active ? "text-foreground" : "text-muted-foreground")}>{label}</span>
              <span className="font-medium tabular-nums">{summary[key]}</span>
            </button>
          )
        })}
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
          <Button variant="outline" size="sm" className="mt-4" onClick={() => fetchList(date, filter)}>
            Retry
          </Button>
        </div>
      ) : entries.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">
          {filter === "total"
            ? "No attendance entries for this date."
            : "No entries match the selected filter."}
        </p>
      ) : (
        <>
          <div className="data-card-list flex flex-col lg:hidden">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "rounded-xl border border-border/70 bg-card/60 p-3 space-y-2",
                  isAdmin && entry.slackUserId && "cursor-pointer hover:bg-card/80"
                )}
                onClick={() => {
                  if (isAdmin && entry.slackUserId) void openUserDetail(entry.slackUserId)
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{entry.userName}</p>
                  </div>
                  <EtaBadgePill badge={entry.badge} />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>ETA: {entry.etaText || "—"}</span>
                  <span>This month: {monthCountsLabel(entry.monthCounts)}</span>
                  <span className="inline-flex items-center gap-1.5">
                    Reminder:
                    {entry.reminderSentAt ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" aria-label="Reminder sent" />
                    ) : (
                      <span aria-label="Reminder not sent">—</span>
                    )}
                  </span>
                </div>
                {isAdmin && isRemindableEntry(entry) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={remindingSlackUserId === entry.slackUserId}
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleRemindOne(entry)
                    }}
                  >
                    {remindingSlackUserId === entry.slackUserId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Bell className="h-3.5 w-3.5" />
                    )}
                    Remind
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="data-table-shell hidden lg:block rounded-lg border border-border/70">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>ETA</TableHead>
                  <TableHead>This month</TableHead>
                  <TableHead>Badge</TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap">Reminder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className={cn(isAdmin && entry.slackUserId && "cursor-pointer")}
                    onClick={() => {
                      if (isAdmin && entry.slackUserId) void openUserDetail(entry.slackUserId)
                    }}
                  >
                    <TableCell className="font-medium whitespace-nowrap">{entry.userName}</TableCell>
                    <TableCell className="tabular-nums whitespace-nowrap">{entry.etaText || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                      {monthCountsLabel(entry.monthCounts)}
                    </TableCell>
                    <TableCell>
                      <EtaBadgePill badge={entry.badge} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {entry.reminderSentAt ? (
                          <Check
                            className="h-4 w-4 shrink-0 text-emerald-500"
                            aria-label="Reminder sent"
                          />
                        ) : (
                          <span className="w-4 text-center text-muted-foreground" aria-label="Reminder not sent">
                            —
                          </span>
                        )}
                        {isAdmin && isRemindableEntry(entry) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            disabled={remindingSlackUserId === entry.slackUserId}
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleRemindOne(entry)
                            }}
                            title={`Remind ${entry.userName}`}
                          >
                            {remindingSlackUserId === entry.slackUserId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Bell className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        ) : null}
                      </div>
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
            This will DM people still missing attendance or waiting on manager approval (WFH/leave)
            for {formatIstDateLabel(date)}. People who already received a reminder or are on the
            production pod are skipped.
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

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDetailOpen(false)
            setDetail(null)
            setEditCountsOpen(false)
            setCountDraft(null)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-6 text-left">
              {detailLoading
                ? "Loading…"
                : detail?.stats.userName || detail?.stats.userEmail || "Person detail"}
            </DialogTitle>
          </DialogHeader>

          {detailLoading && (
            <div className="space-y-3 py-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}

          {!detailLoading && detail && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">{detail.stats.userEmail || "—"}</p>
                  {detail.stats.countsResetAt && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Counters since {formatEntryDate(detail.stats.countsResetAt)}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openEditCounts}
                  disabled={savingCounts}
                >
                  <Pencil className="h-4 w-4" />
                  Edit counters
                </Button>
              </div>

              <section className="space-y-2">
                <h3 className="text-sm font-medium">WFH</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatChip label="Total" value={detail.breakdown.wfh.total} />
                  <StatChip label="Approved" value={detail.breakdown.wfh.approved} tone="good" />
                  <StatChip label="Rejected" value={detail.breakdown.wfh.denied} tone="bad" />
                  <StatChip label="Pending" value={detail.breakdown.wfh.pending} tone="warn" />
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-medium">Leave</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatChip label="Total" value={detail.breakdown.leave.total} />
                  <StatChip label="Approved" value={detail.breakdown.leave.approved} tone="good" />
                  <StatChip label="Rejected" value={detail.breakdown.leave.denied} tone="bad" />
                  <StatChip label="Pending" value={detail.breakdown.leave.pending} tone="warn" />
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-medium">Other</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatChip label="Missing" value={detail.breakdown.missing} />
                  <StatChip label="On time" value={detail.breakdown.onTime} tone="good" />
                  <StatChip label="Late submit" value={detail.breakdown.lateSubmission} tone="warn" />
                  <StatChip label="Late arrival" value={detail.breakdown.lateArrival} tone="bad" />
                </div>
              </section>

              <div className="space-y-4">
                <HistoryList title="WFH approved" items={detail.groups.wfh.approved} />
                <HistoryList title="WFH rejected" items={detail.groups.wfh.denied} />
                <HistoryList title="WFH pending" items={detail.groups.wfh.pending} />
                <HistoryList title="Leave approved" items={detail.groups.leave.approved} />
                <HistoryList title="Leave rejected" items={detail.groups.leave.denied} />
                <HistoryList title="Leave pending" items={detail.groups.leave.pending} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editCountsOpen}
        onOpenChange={(open) => {
          setEditCountsOpen(open)
          if (!open) setCountDraft(null)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit counters</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Set rolling numbers for {detail?.stats.userName || "this person"} to any value. History
            lists stay unchanged; new attendance after today still adds on.
          </p>
          {countDraft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">WFH</h4>
                <div className="grid grid-cols-3 gap-2">
                  <CountField
                    label="Approved"
                    value={countDraft.wfhApproved}
                    onChange={(v) => setCountDraft((d) => (d ? { ...d, wfhApproved: v } : d))}
                  />
                  <CountField
                    label="Rejected"
                    value={countDraft.wfhDenied}
                    onChange={(v) => setCountDraft((d) => (d ? { ...d, wfhDenied: v } : d))}
                  />
                  <CountField
                    label="Pending"
                    value={countDraft.wfhPending}
                    onChange={(v) => setCountDraft((d) => (d ? { ...d, wfhPending: v } : d))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Leave</h4>
                <div className="grid grid-cols-3 gap-2">
                  <CountField
                    label="Approved"
                    value={countDraft.leaveApproved}
                    onChange={(v) => setCountDraft((d) => (d ? { ...d, leaveApproved: v } : d))}
                  />
                  <CountField
                    label="Rejected"
                    value={countDraft.leaveDenied}
                    onChange={(v) => setCountDraft((d) => (d ? { ...d, leaveDenied: v } : d))}
                  />
                  <CountField
                    label="Pending"
                    value={countDraft.leavePending}
                    onChange={(v) => setCountDraft((d) => (d ? { ...d, leavePending: v } : d))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Other</h4>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <CountField
                    label="Missing"
                    value={countDraft.missing}
                    onChange={(v) => setCountDraft((d) => (d ? { ...d, missing: v } : d))}
                  />
                  <CountField
                    label="On time"
                    value={countDraft.onTime}
                    onChange={(v) => setCountDraft((d) => (d ? { ...d, onTime: v } : d))}
                  />
                  <CountField
                    label="Late submit"
                    value={countDraft.lateSubmission}
                    onChange={(v) => setCountDraft((d) => (d ? { ...d, lateSubmission: v } : d))}
                  />
                  <CountField
                    label="Late arrival"
                    value={countDraft.lateArrival}
                    onChange={(v) => setCountDraft((d) => (d ? { ...d, lateArrival: v } : d))}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditCountsOpen(false)}
              disabled={savingCounts}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSaveCounts()} disabled={savingCounts || !countDraft}>
              {savingCounts ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              Save counters
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
