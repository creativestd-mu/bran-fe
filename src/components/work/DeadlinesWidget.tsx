import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { workApi } from "@/lib/api"
import type { DeadlineStep } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CalendarClock, Lock } from "lucide-react"

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
}

export function DeadlinesWidget() {
  const [deadlines, setDeadlines] = useState<DeadlineStep[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    workApi
      .deadlines()
      .then((res) => {
        if (!cancelled) setDeadlines(res.deadlines.filter((d) => !d.done))
      })
      .catch(() => {
        if (!cancelled) setDeadlines([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Due today</CardTitle>
        <span title="Work-unit steps due today" aria-label="Work-unit steps due today">
          <CalendarClock className="h-4 w-4 text-accent" />
        </span>
      </CardHeader>
      <CardContent className="min-w-0 overflow-hidden">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : deadlines.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No deadlines today.</p>
        ) : (
          <ul className="space-y-2">
            {deadlines.map((item) => (
              <li key={item.id} className="min-w-0">
                <Link
                  to="/work"
                  className="block min-w-0 overflow-hidden rounded-lg border border-border/60 p-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="line-clamp-2 break-words text-sm font-medium leading-snug">{item.description}</p>
                      <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                        <span className="truncate">{item.workUnit.title}</span>
                        {item.workUnit.isPrivate && (
                          <Lock className="h-3 w-3 shrink-0" aria-label="Private" />
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(item.deadline)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
