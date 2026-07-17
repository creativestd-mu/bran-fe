import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"

const TABS = [
  { label: "Daily", path: "/attendance" },
  { label: "Policies", path: "/attendance/policies" },
] as const

export function AttendanceSubNav() {
  const location = useLocation()

  return (
    <div className="filter-chip-row">
      {TABS.map((tab) => {
        const active =
          tab.path === "/attendance"
            ? location.pathname === "/attendance"
            : location.pathname.startsWith(tab.path)
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              active
                ? "border-primary/50 bg-primary/15 text-foreground"
                : "border-border/70 bg-card/55 text-muted-foreground hover:border-border hover:bg-card/80 hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
