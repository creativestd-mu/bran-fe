import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { logNavSearchQuery } from "@/lib/navigationAnalytics"
import { getNavSearchResults, type NavSearchItem } from "@/lib/navSearch"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Search } from "lucide-react"
import { NavSearchResults } from "./NavSearchResults"

interface CommandSearchProps {
  open: boolean
  onClose: () => void
}

export function CommandSearch({ open, onClose }: CommandSearchProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const results = getNavSearchResults(user, query)

  useEffect(() => {
    if (open) {
      setQuery("")
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  const commit = useCallback(
    (item: NavSearchItem) => {
      logNavSearchQuery(query, item.path)
      navigate(item.path)
      onClose()
    },
    [navigate, onClose, query]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && query.trim()) {
      if (results[activeIndex]) {
        e.preventDefault()
        commit(results[activeIndex])
        return
      }
      e.preventDefault()
      logNavSearchQuery(query)
      return
    }

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Escape") {
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-lg gap-0 overflow-hidden p-0 [&>button]:right-3 [&>button]:top-3"
        onKeyDown={handleKeyDown}
        aria-label="Command search"
      >
        <div className="flex items-center gap-3 border-b border-border py-3 pl-4 pr-12">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages or describe what you want to do…"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>

        <NavSearchResults
          results={results}
          activeIndex={activeIndex}
          onActiveIndexChange={setActiveIndex}
          onSelect={commit}
          listRef={listRef}
          className="max-h-[min(50vh,420px)]"
        />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-border px-1 font-mono text-[10px] leading-none">
              ↑↓
            </kbd>
            navigate
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-border px-1 font-mono text-[10px] leading-none">
              ↵
            </kbd>
            open
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-border px-1 font-mono text-[10px] leading-none">
              Esc
            </kbd>
            close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
