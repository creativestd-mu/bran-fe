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
        className="overflow-hidden p-0 gap-0 max-w-lg"
        onKeyDown={handleKeyDown}
        aria-label="Command search"
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages or describe what you want to do…"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-xs text-muted-foreground hover:text-foreground"
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
          className="max-h-[360px]"
        />

        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span><kbd className="rounded border border-border px-1 py-0.5 font-mono text-[10px]">↑↓</kbd> navigate</span>
          <span><kbd className="rounded border border-border px-1 py-0.5 font-mono text-[10px]">↵</kbd> open</span>
          <span><kbd className="rounded border border-border px-1 py-0.5 font-mono text-[10px]">Esc</kbd> close</span>
          <span className="ml-auto opacity-60">⌘K to open anytime</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
