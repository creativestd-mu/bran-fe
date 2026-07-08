import type { User, WorkUserRef } from "@/types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { sortUsersForAssigneePicker } from "./assigneeUtils"

interface AssigneeSelectProps {
  users: User[]
  currentUserId?: string
  value: string | null
  onChange: (userId: string | null) => void
  includeUnassigned?: boolean
  unassignedLabel?: string
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function AssigneeSelect({
  users,
  currentUserId,
  value,
  onChange,
  includeUnassigned = true,
  unassignedLabel = "Unassigned",
  placeholder = "Select assignee",
  className,
  disabled,
}: AssigneeSelectProps) {
  const sorted = sortUsersForAssigneePicker(users, currentUserId)
  const directReportIds = new Set(sorted.filter((user) => user.managerUserId === currentUserId).map((user) => user.id))

  return (
    <Select
      value={value ?? "none"}
      onValueChange={(next) => onChange(next === "none" ? null : next)}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeUnassigned && <SelectItem value="none">{unassignedLabel}</SelectItem>}
        {sorted.map((user) => (
          <SelectItem key={user.id} value={user.id}>
            {user.name}
            {directReportIds.has(user.id) ? " · direct report" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface AssigneeTagProps {
  spokenName?: string | null
  assignee: WorkUserRef | null
  prefix?: string
}

export function AssigneeTag({ spokenName, assignee, prefix = "Owner" }: AssigneeTagProps) {
  const resolved = assignee?.name ?? "Unassigned"
  if (spokenName) {
    return (
      <span className="text-xs text-muted-foreground">
        {prefix}: <span className="text-foreground">Tagged as {spokenName}</span> → {resolved}
      </span>
    )
  }
  return (
    <span className="text-xs text-muted-foreground">
      {prefix}: <span className="text-foreground">{resolved}</span>
    </span>
  )
}

interface AssigneeCorrectionProps {
  spokenName: string
  assignee: WorkUserRef | null
  users: User[]
  currentUserId?: string
  value: string | null
  onChange: (userId: string | null) => void
  onSave: () => void
  saving?: boolean
  label?: string
}

export function AssigneeCorrection({
  spokenName,
  assignee,
  users,
  currentUserId,
  value,
  onChange,
  onSave,
  saving,
  label = "Correct assignee",
}: AssigneeCorrectionProps) {
  const currentValue = value ?? assignee?.id ?? null
  const changed = currentValue !== (assignee?.id ?? null)

  return (
    <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5">
      <p className="text-xs text-muted-foreground">
        {label}: <span className="font-medium text-foreground">{spokenName}</span>
        {" → "}
        <span className="text-foreground">{assignee?.name ?? "Unassigned"}</span>
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <AssigneeSelect
          users={users}
          currentUserId={currentUserId}
          value={currentValue}
          onChange={onChange}
          className="h-8 w-full sm:max-w-[240px] text-xs"
          unassignedLabel="Unassigned"
        />
        <button
          type="button"
          className="text-xs font-medium text-accent disabled:opacity-50"
          disabled={!changed || saving}
          onClick={onSave}
        >
          {saving ? "Saving…" : "Save correction"}
        </button>
      </div>
    </div>
  )
}
