import { useEffect, useState } from "react"
import { aiApi } from "@/lib/api"
import type { AIQueryHistoryItem, AIQueryResponse } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Send, Brain, Clock, Users, BarChart3, Target, Compass, Sparkles, Plus, History } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { validateRequiredText } from "@/lib/validation"
import Markdown from "react-markdown"

interface QueryEntry {
  id: string
  query: string
  response: AIQueryResponse
  timestamp: Date
}

const PERFORMANCE_QUERIES = [
  "What did the team do this week?",
  "How has the team performed this month?",
  "Show me the task report for last week",
]

const GUIDANCE_QUERIES = [
  "What should I focus on?",
  "What more should I do to align with our vision?",
  "How can I increase my impact this quarter?",
  "What is the vision of our team in the next year?",
]

export default function AIQueryPage() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<QueryEntry[]>([])
  const [activeResult, setActiveResult] = useState<QueryEntry | null>(null)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    aiApi
      .listQueries({ page: 1, pageSize: 20 })
      .then((res) => {
        const entries: QueryEntry[] = res.items.map((item: AIQueryHistoryItem) => ({
          id: item.id,
          query: item.query,
          response: { report: item.report, meta: item.meta },
          timestamp: new Date(item.createdAt),
        }))
        setHistory(entries)
        if (entries[0]) setActiveResult(entries[0])
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }, [])

  const startNewChat = () => {
    setActiveResult(null)
    setQuery("")
  }

  const handleSubmit = async (q?: string) => {
    const text = q || query.trim()
    const validationError = validateRequiredText(text, "Question")
    if (validationError) {
      toast.error(validationError)
      return
    }

    setLoading(true)
    setQuery("")
    try {
      const response = await aiApi.query(text)
      const entry: QueryEntry = {
        id: response.meta.queryId ?? crypto.randomUUID(),
        query: text,
        response,
        timestamp: new Date(),
      }
      setHistory((prev) => [entry, ...prev.filter((e) => e.id !== entry.id)])
      setActiveResult(entry)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to query AI"
      toast.error(
        /internal server error/i.test(message)
          ? "AI query failed. Please try again in a moment."
          : message
      )
    } finally {
      setLoading(false)
    }
  }

  const meta = activeResult?.response.meta

  const historyList = (
    <div className="space-y-1">
      {historyLoading ? (
        <Skeleton className="h-12 w-full" />
      ) : history.length === 0 ? (
        <p className="py-4 text-xs text-muted-foreground">No queries yet.</p>
      ) : (
        history.map((entry) => (
          <button
            key={entry.id}
            className={`w-full min-w-0 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
              activeResult?.id === entry.id
                ? "bg-primary/15 text-accent"
                : "text-muted-foreground hover:bg-muted"
            }`}
            onClick={() => {
              setActiveResult(entry)
              setHistoryOpen(false)
            }}
          >
            <p className="truncate font-medium">{entry.query}</p>
            <p className="mt-0.5 truncate text-xs opacity-60">{entry.timestamp.toLocaleString()}</p>
          </button>
        ))
      )}
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-1 gap-3 p-3 sm:gap-4 sm:p-4 lg:p-5">
      <Card className="hidden h-full w-72 shrink-0 flex-col overflow-hidden lg:flex">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm text-accent">Query History</CardTitle>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5" onClick={startNewChat}>
            <Plus className="h-3.5 w-3.5" />
            New chat
          </Button>
        </CardHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-1 px-3 pb-4">
            {historyList}
          </div>
        </ScrollArea>
      </Card>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/55 bg-background/72 shadow-2xl shadow-black/10 backdrop-blur-xl dark:bg-background/62 sm:rounded-2xl lg:rounded-[2rem]">
        <div className="flex items-center justify-end gap-2 px-3 pt-3 lg:hidden">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setHistoryOpen(true)}>
            <History className="h-3.5 w-3.5" />
            History
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={startNewChat}>
            <Plus className="h-3.5 w-3.5" />
            New chat
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {loading ? (
            <Card>
              <CardContent className="space-y-3 p-6">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ) : activeResult ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
                <p className="text-sm font-medium text-accent">{activeResult.query}</p>
              </div>

              <Card>
                <CardContent className="prose prose-invert prose-sm max-w-none break-words p-6 [&_*]:break-words [&_h1]:text-accent [&_h2]:text-accent [&_h3]:text-accent [&_strong]:text-foreground [&_a]:break-all [&_a]:text-accent">
                  <Markdown>{activeResult.response.report}</Markdown>
                </CardContent>
              </Card>

              {meta && (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="gap-1.5 py-1">
                    <Users className="h-3 w-3" />
                    {meta.user.name}
                  </Badge>
                  <Badge variant="outline" className="gap-1.5 py-1">
                    <Clock className="h-3 w-3" />
                    {(() => {
                      const tz = "Asia/Kolkata"
                      const from = new Date(meta.timeRange.from)
                      const to = new Date(meta.timeRange.to)
                      const dayKey = (d: Date) =>
                        d.toLocaleDateString("en-CA", { timeZone: tz })
                      const label = (d: Date) =>
                        d.toLocaleDateString(undefined, { timeZone: tz })
                      // Same calendar day in app TZ → single date (fixes "yesterday" spanning 2 days)
                      if (dayKey(from) === dayKey(to)) return label(from)
                      return `${label(from)} — ${label(to)}`
                    })()}
                  </Badge>
                  <Badge variant="outline" className="gap-1.5 py-1">
                    <BarChart3 className="h-3 w-3" />
                    {(meta.analyzedItemsCount ??
                      (meta.taskCount ?? 0) +
                        (meta.adhocWorkCount ?? 0) +
                        (meta.workUnitCount ?? 0))}{" "}
                    items analyzed
                  </Badge>
                  {meta.adhocWorkCount != null && (
                    <Badge variant="outline" className="gap-1.5 py-1">
                      {meta.adhocWorkCount} adhoc entries
                    </Badge>
                  )}
                  {meta.workUnitCount != null && (
                    <Badge variant="outline" className="gap-1.5 py-1">
                      {meta.workUnitCount} work units
                    </Badge>
                  )}
                  {meta.guidanceQuery && (
                    <Badge variant="default" className="gap-1.5 py-1">
                      <Compass className="h-3 w-3" />
                      Vision guidance
                    </Badge>
                  )}
                  {(meta.visionCount ?? 0) > 0 && (
                    <Badge variant="outline" className="gap-1.5 py-1">
                      <Sparkles className="h-3 w-3" />
                      {meta.visionCount} visions
                    </Badge>
                  )}
                  {(meta.kpiCount ?? 0) > 0 && (
                    <Badge variant="outline" className="gap-1.5 py-1">
                      <Target className="h-3 w-3" />
                      {meta.kpiCount} KPIs
                    </Badge>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center space-y-6 text-center">
              <Brain className="h-16 w-16 text-accent/40" />
              <div>
                <h2 className="font-brand text-xl text-accent">AI Query</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Performance reports and vision-aligned guidance from your recent work.
                </p>
              </div>
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Performance</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {PERFORMANCE_QUERIES.map((eq) => (
                    <Button key={eq} variant="outline" size="sm" onClick={() => handleSubmit(eq)}>
                      {eq}
                    </Button>
                  ))}
                </div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Vision & focus</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {GUIDANCE_QUERIES.map((eq) => (
                    <Button key={eq} variant="outline" size="sm" onClick={() => handleSubmit(eq)}>
                      {eq}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <Separator />

        <div className="p-3 sm:p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleSubmit()
            }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about performance or what to focus on…"
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !query.trim()} className="gap-2 sm:shrink-0">
              <Send className="h-4 w-4" />
              {loading ? "Thinking..." : "Ask"}
            </Button>
          </form>
        </div>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Query History</DialogTitle>
          </DialogHeader>
          {historyList}
        </DialogContent>
      </Dialog>
    </div>
  )
}
