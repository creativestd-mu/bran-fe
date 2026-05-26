import { useState } from "react"
import { aiApi } from "@/lib/api"
import type { AIQueryResponse } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Send, Brain, Clock, Users, BarChart3 } from "lucide-react"
import Markdown from "react-markdown"

interface QueryEntry {
  id: string
  query: string
  response: AIQueryResponse
  timestamp: Date
}

const EXAMPLE_QUERIES = [
  "What did the team do this week?",
  "How has the team performed this month?",
  "Show me the task report for last week",
]

export default function AIQueryPage() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<QueryEntry[]>([])
  const [activeResult, setActiveResult] = useState<QueryEntry | null>(null)

  const handleSubmit = async (q?: string) => {
    const text = q || query.trim()
    if (!text) return

    setLoading(true)
    setQuery("")
    try {
      const response = await aiApi.query(text)
      const entry: QueryEntry = {
        id: crypto.randomUUID(),
        query: text,
        response,
        timestamp: new Date(),
      }
      setHistory((prev) => [entry, ...prev])
      setActiveResult(entry)
    } catch {
      toast.error("Failed to query AI")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {history.length > 0 && (
        <Card className="hidden lg:flex w-72 shrink-0 flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-accent">Query History</CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1">
            <div className="space-y-1 px-4 pb-4">
              {history.map((entry) => (
                <button
                  key={entry.id}
                  className={`w-full text-left rounded-lg p-2.5 text-sm transition-colors ${
                    activeResult?.id === entry.id ? "bg-primary/15 text-accent" : "text-muted-foreground hover:bg-muted"
                  }`}
                  onClick={() => setActiveResult(entry)}
                >
                  <p className="truncate font-medium">{entry.query}</p>
                  <p className="text-xs mt-0.5 opacity-60">{entry.timestamp.toLocaleTimeString()}</p>
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>
      )}

      <div className="flex flex-1 flex-col">
        <div className="flex-1 overflow-y-auto p-2">
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
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
                <p className="text-sm font-medium text-accent">{activeResult.query}</p>
              </div>

              <Card>
                <CardContent className="prose prose-invert prose-sm max-w-none p-6 [&_h1]:text-accent [&_h2]:text-accent [&_h3]:text-accent [&_strong]:text-foreground [&_a]:text-accent">
                  <Markdown>{activeResult.response.report}</Markdown>
                </CardContent>
              </Card>

              <div className="flex flex-wrap gap-3">
                <Badge variant="outline" className="gap-1.5 py-1">
                  <Users className="h-3 w-3" />
                  {activeResult.response.meta.user.name}
                </Badge>
                <Badge variant="outline" className="gap-1.5 py-1">
                  <Clock className="h-3 w-3" />
                  {new Date(activeResult.response.meta.timeRange.from).toLocaleDateString()} — {new Date(activeResult.response.meta.timeRange.to).toLocaleDateString()}
                </Badge>
                <Badge variant="outline" className="gap-1.5 py-1">
                  <BarChart3 className="h-3 w-3" />
                  {activeResult.response.meta.taskCount} tasks analyzed
                </Badge>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
              <Brain className="h-16 w-16 text-accent/40" />
              <div>
                <h2 className="font-brand text-xl text-accent">AI Performance Query</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Ask about your team's performance and get AI-powered insights
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLE_QUERIES.map((eq) => (
                  <Button key={eq} variant="outline" size="sm" onClick={() => handleSubmit(eq)}>
                    {eq}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator />

        <div className="p-4">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
            className="flex gap-2"
          >
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about your team's performance..."
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !query.trim()} className="gap-2">
              <Send className="h-4 w-4" />
              {loading ? "Thinking..." : "Ask"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
