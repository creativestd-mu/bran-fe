import { useMemo, useState } from "react"
import type { TaggingMapping, User } from "@/types"
import { Loader2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { sortUsersForAssigneePicker } from "./assigneeUtils"
import { buildTranscriptSegments, taggingMappingKey } from "./transcriptTagUtils"

interface TranscriptTagCanvasProps {
  transcript: string
  mappings: TaggingMapping[]
  users: User[]
  currentUserId?: string
  onAssignmentChange: (mapping: TaggingMapping, assigneeId: string | null) => void | Promise<void>
  savingMappingKey?: string | null
  disabled?: boolean
  className?: string
}

export function TranscriptTagCanvas({
  transcript,
  mappings,
  users,
  currentUserId,
  onAssignmentChange,
  savingMappingKey,
  disabled,
  className,
}: TranscriptTagCanvasProps) {
  const segments = useMemo(
    () => buildTranscriptSegments(transcript, mappings),
    [transcript, mappings]
  )
  const sortedUsers = useMemo(
    () => sortUsersForAssigneePicker(users, currentUserId),
    [users, currentUserId]
  )
  const directReportIds = useMemo(
    () => new Set(sortedUsers.filter((user) => user.managerUserId === currentUserId).map((user) => user.id)),
    [sortedUsers, currentUserId]
  )
  const [openKey, setOpenKey] = useState<string | null>(null)

  if (!transcript.trim()) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>No transcript available.</p>
    )
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-muted/20 p-4 text-sm leading-relaxed text-foreground",
        className
      )}
    >
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return (
            <span key={`text-${index}`} className="whitespace-pre-wrap break-words">
              {segment.text}
            </span>
          )
        }

        const key = segment.mappingKey
        const isSaving = savingMappingKey === key
        const currentAssigneeId = segment.mapping.assigneeId

        return (
          <DropdownMenu
            key={`tag-${key}-${index}`}
            open={openKey === key}
            onOpenChange={(open) => setOpenKey(open ? key : null)}
          >
            <DropdownMenuTrigger asChild disabled={disabled || isSaving}>
              <button
                type="button"
                className={cn(
                  "mx-0.5 inline-flex max-w-full items-center gap-1 rounded-md bg-accent/15 px-1.5 py-0.5 align-baseline font-medium text-accent transition-colors",
                  "hover:bg-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                  (disabled || isSaving) && "pointer-events-none opacity-60"
                )}
                title={
                  segment.mapping.spokenName
                    ? `Tagged as ${segment.mapping.spokenName} — click to reassign`
                    : "Click to reassign"
                }
              >
                {isSaving ? (
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                ) : null}
                <span className="truncate">#{segment.label.replace(/\s+/g, "")}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-64 w-56 overflow-y-auto">
              {sortedUsers.map((user) => (
                <DropdownMenuItem
                  key={user.id}
                  onSelect={() => {
                    setOpenKey(null)
                    void onAssignmentChange(segment.mapping, user.id)
                  }}
                  className={cn(user.id === currentAssigneeId && "bg-muted/60")}
                >
                  <span className="truncate">{user.name}</span>
                  {directReportIds.has(user.id) ? (
                    <span className="ml-auto text-[10px] text-muted-foreground">direct report</span>
                  ) : null}
                </DropdownMenuItem>
              ))}
              {segment.mapping.target === "step" ? (
                <DropdownMenuItem
                  onSelect={() => {
                    setOpenKey(null)
                    void onAssignmentChange(segment.mapping, null)
                  }}
                  className={cn(!currentAssigneeId && "bg-muted/60")}
                >
                  Unassigned
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })}
    </div>
  )
}
