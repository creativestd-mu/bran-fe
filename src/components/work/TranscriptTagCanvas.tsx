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
    () =>
      new Set(
        sortedUsers
          .filter((user) => user.managerUserId === currentUserId)
          .map((user) => user.id)
      ),
    [sortedUsers, currentUserId]
  )
  const mappingControls = useMemo(() => {
    const byKey = new Map<string, TaggingMapping>()
    for (const mapping of mappings) byKey.set(taggingMappingKey(mapping), mapping)
    return [...byKey.entries()]
  }, [mappings])
  const [openKey, setOpenKey] = useState<string | null>(null)

  if (!transcript.trim()) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>No transcript available.</p>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      {mappingControls.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
          <span className="mr-1 text-xs text-muted-foreground">Assignments</span>
          {mappingControls.map(([key, mapping]) => {
            const isSaving = savingMappingKey === key
            const currentAssigneeId = mapping.assigneeId
            const label = mapping.assignee?.name ?? mapping.spokenName ?? "Unassigned"

            return (
              <DropdownMenu
                key={key}
                open={openKey === key}
                onOpenChange={(open) => setOpenKey(open ? key : null)}
              >
                <DropdownMenuTrigger asChild disabled={disabled || isSaving}>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex max-w-full items-center gap-1 rounded-md bg-accent/15 px-2 py-1 text-xs font-medium text-accent transition-colors",
                      "hover:bg-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                      (disabled || isSaving) && "pointer-events-none opacity-60"
                    )}
                    title="Click to reassign"
                  >
                    {isSaving ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> : null}
                    <span className="truncate">#{label.replace(/\s+/g, "")}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-64 w-56 overflow-y-auto">
                  {sortedUsers.map((user) => (
                    <DropdownMenuItem
                      key={user.id}
                      onSelect={() => {
                        setOpenKey(null)
                        void onAssignmentChange(mapping, user.id)
                      }}
                      className={cn(user.id === currentAssigneeId && "bg-muted/60")}
                    >
                      <span className="truncate">{user.name}</span>
                      {directReportIds.has(user.id) ? (
                        <span className="ml-auto text-[10px] text-muted-foreground">direct report</span>
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                  {mapping.target === "step" ? (
                    <DropdownMenuItem
                      onSelect={() => {
                        setOpenKey(null)
                        void onAssignmentChange(mapping, null)
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
      ) : null}

      <div className="max-h-64 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-4 text-sm leading-7 text-foreground">
        {segments.map((segment, index) => {
          const text = segment.type === "tag" ? segment.label : segment.text
          return (
            <span
              key={`${segment.type}-${index}`}
              className={cn(
                "whitespace-pre-wrap break-words [box-decoration-break:clone]",
                segment.highlighted &&
                  "rounded-sm bg-yellow-200/90 px-0.5 py-0.5 text-foreground dark:bg-yellow-400/35"
              )}
              title={segment.highlighted ? "Source quote for a work point" : undefined}
            >
              {text}
            </span>
          )
        })}
      </div>
    </div>
  )
}
