import { ArrowRight } from "lucide-react"
import type { NavSearchItem } from "@/lib/navSearch"

interface NavSearchResultsProps {
  results: NavSearchItem[]
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  onSelect: (item: NavSearchItem) => void
  emptyMessage?: string
  listRef?: React.RefObject<HTMLDivElement | null>
  className?: string
}

export function NavSearchResults({
  results,
  activeIndex,
  onActiveIndexChange,
  onSelect,
  emptyMessage = "No matching pages found.",
  listRef,
  className = "",
}: NavSearchResultsProps) {
  if (results.length === 0) {
    return (
      <p className={`py-10 text-center text-sm text-muted-foreground ${className}`}>
        {emptyMessage}
      </p>
    )
  }

  return (
    <div ref={listRef} className={`overflow-y-auto py-2 ${className}`}>
      {results.map((item, i) => {
        const Icon = item.icon
        const isActive = i === activeIndex
        return (
          <button
            key={item.path}
            type="button"
            onClick={() => onSelect(item)}
            onMouseEnter={() => onActiveIndexChange(i)}
            className={[
              "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
              isActive ? "bg-primary/10 text-foreground" : "text-foreground hover:bg-muted/50",
            ].join(" ")}
          >
            <span
              className={[
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                isActive ? "bg-primary/15 text-accent" : "bg-muted/60 text-muted-foreground",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-none">{item.label}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{item.description}</p>
            </div>
            {isActive && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-accent" />}
          </button>
        )
      })}
    </div>
  )
}
