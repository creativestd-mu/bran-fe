import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { logNavSearchQuery } from "@/lib/navigationAnalytics"
import { getNavItemByPath, getNavSearchResults, getVisibleNavSearchItems, type NavSearchItem } from "@/lib/navSearch"
import { NavSearchResults } from "@/components/layout/NavSearchResults"
import { Search } from "lucide-react"

export default function DashboardPage() {
  const { user, mostVisitedPages } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const results = getNavSearchResults(user, query)
  const showResults = query.trim().length > 0

  const quickLinks = useMemo(() => {
    const visiblePaths = new Set(getVisibleNavSearchItems(user).map((item) => item.path))
    return mostVisitedPages
      .map((page) => ({ page, item: getNavItemByPath(page.path) }))
      .filter(({ item }) => item && visiblePaths.has(item.path))
      .slice(0, 3)
  }, [mostVisitedPages, user])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    if (!showResults) return
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: "nearest" })
  }, [activeIndex, showResults])

  const commit = useCallback(
    (item: NavSearchItem) => {
      logNavSearchQuery(query, item.path)
      navigate(item.path)
    },
    [navigate, query]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && query.trim()) {
      if (showResults && results[activeIndex]) {
        e.preventDefault()
        commit(results[activeIndex])
        return
      }
      if (!showResults || results.length === 0) {
        e.preventDefault()
        logNavSearchQuery(query)
      }
      return
    }

    if (!showResults) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="font-brand text-4xl tracking-wide text-accent sm:text-5xl">BRan</h1>
          {user?.name && (
            <p className="mt-2 text-sm text-muted-foreground">
              Hi {user.name.split(" ")[0]} — what would you like to do?
            </p>
          )}
        </div>

        <div
          className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-lg shadow-black/5 backdrop-blur-xl"
          onKeyDown={handleKeyDown}
        >
          <div className="flex items-center gap-3 px-5 py-4">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages or describe what you want to do…"
              className="flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-lg"
              autoComplete="off"
              spellCheck={false}
              aria-label="Search BRan"
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

          {showResults && (
            <>
              <div className="border-t border-border/60" />
              <NavSearchResults
                results={results}
                activeIndex={activeIndex}
                onActiveIndexChange={setActiveIndex}
                onSelect={commit}
                listRef={listRef}
                className="max-h-[min(50vh,420px)]"
              />
            </>
          )}
        </div>

        {!showResults && quickLinks.length > 0 && (
          <div className="space-y-3">
            <p className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Your frequent pages
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {quickLinks.map(({ page, item }) => {
                if (!item) return null
                const Icon = item.icon
                return (
                  <button
                    key={page.path}
                    type="button"
                    onClick={() => navigate(page.path)}
                    className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10"
                  >
                    <Icon className="h-3.5 w-3.5 text-accent" />
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {!showResults && quickLinks.length === 0 && (
          <p className="text-center text-xs text-muted-foreground">
            Try &ldquo;log my hours&rdquo;, &ldquo;team tasks&rdquo;, or &ldquo;voice memo&rdquo;
          </p>
        )}
      </div>
    </div>
  )
}
