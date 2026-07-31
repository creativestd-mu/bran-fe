import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import type { User } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface SearchableUserSelectProps {
  users: User[]
  value: string | null
  onChange: (userId: string | null) => void
  noneLabel?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}

function userLabel(user: User) {
  const suffix = user.isPlaceholder ? " (new hire)" : !user.isActive ? " (inactive)" : ""
  return `${user.name}${user.designation ? ` · ${user.designation}` : ""}${suffix}`
}

function matchesQuery(user: User, query: string) {
  if (!query) return true
  const haystack = `${user.name} ${user.email} ${user.designation ?? ""}`.toLowerCase()
  return haystack.includes(query)
}

export function SearchableUserSelect({
  users,
  value,
  onChange,
  noneLabel = "No manager",
  placeholder = "Select person",
  disabled = false,
  className,
}: SearchableUserSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name)),
    [users]
  )

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return sortedUsers.filter((user) => matchesQuery(user, query))
  }, [sortedUsers, search])

  const selected = value ? sortedUsers.find((user) => user.id === value) : null
  const triggerLabel = selected ? userLabel(selected) : noneLabel || placeholder

  useEffect(() => {
    if (!open) {
      setSearch("")
      return
    }
    const id = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open])

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-between rounded-xl border-border/80 bg-card/70 px-3 font-normal shadow-sm hover:bg-card/70",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate text-left">{triggerLabel}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[16rem] p-0"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <div
          className="sticky top-0 z-10 border-b border-border/60 bg-popover p-2"
          onKeyDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search people…"
              className="h-8 pl-8"
            />
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto p-1">
          <DropdownMenuItem
            className="relative pl-8"
            onSelect={() => {
              onChange(null)
              setOpen(false)
            }}
          >
            {!value && (
              <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                <Check className="h-4 w-4" />
              </span>
            )}
            {noneLabel}
          </DropdownMenuItem>

          {filteredUsers.map((user) => {
            const isSelected = value === user.id
            return (
              <DropdownMenuItem
                key={user.id}
                className="relative pl-8"
                onSelect={() => {
                  onChange(user.id)
                  setOpen(false)
                }}
              >
                {isSelected && (
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <Check className="h-4 w-4" />
                  </span>
                )}
                <span className="truncate">{userLabel(user)}</span>
              </DropdownMenuItem>
            )
          })}

          {filteredUsers.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">No matches</p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
