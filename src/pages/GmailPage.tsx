import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { gmailApi } from "@/lib/api"
import type { GmailMessage, GmailStatus } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { Loader2, Mail, RefreshCw, Unplug } from "lucide-react"
import { cn } from "@/lib/utils"

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso))
}

export default function GmailPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [status, setStatus] = useState<GmailStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const [messages, setMessages] = useState<GmailMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true)
    try {
      const next = await gmailApi.status()
      setStatus(next)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load Gmail status")
      setStatus({ connected: false })
    } finally {
      setStatusLoading(false)
    }
  }, [])

  const fetchMessages = useCallback(async (opts?: { silent?: boolean; q?: string }) => {
    if (!opts?.silent) setMessagesLoading(true)
    try {
      const list = await gmailApi.listMessages({
        limit: 50,
        ...(opts?.q ? { q: opts.q } : {}),
      })
      setMessages(Array.isArray(list) ? list : [])
    } catch (err) {
      if (!opts?.silent) {
        toast.error(err instanceof Error ? err.message : "Failed to load messages")
      }
    } finally {
      if (!opts?.silent) setMessagesLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    void fetchMessages()
  }, [fetchMessages])

  useEffect(() => {
    const gmailParam = searchParams.get("gmail")
    if (!gmailParam) return

    if (gmailParam === "connected") {
      toast.success("Gmail connected. Bran is syncing your recent mail.")
      void fetchStatus()
      void fetchMessages()
    } else if (gmailParam === "error") {
      const message = searchParams.get("message")
      toast.error(
        message === "access_denied"
          ? "Gmail access was denied."
          : message === "missing_oauth_params"
            ? "Gmail connect was incomplete. Try again."
            : "Failed to connect Gmail. Try again."
      )
    }

    const next = new URLSearchParams(searchParams)
    next.delete("gmail")
    next.delete("message")
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, fetchStatus, fetchMessages])

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const result = await gmailApi.connect()
      if (!result.authorizationUrl) {
        throw new Error("No authorization URL returned")
      }
      window.location.href = result.authorizationUrl
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start Gmail connect")
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await gmailApi.disconnect()
      setStatus({ connected: false })
      setMessages([])
      toast.success("Gmail disconnected")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect Gmail")
    } finally {
      setDisconnecting(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await gmailApi.sync()
      setMessages(result.messages ?? [])
      toast.success(`Synced ${result.synced} message${result.synced === 1 ? "" : "s"}`)
      void fetchStatus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sync Gmail")
      void fetchStatus()
    } finally {
      setSyncing(false)
    }
  }

  const handleSearch = async () => {
    await fetchMessages({ q: query.trim() || undefined })
  }

  const connected = Boolean(status?.connected || status?.status === "ERROR")
  const hasError = status?.status === "ERROR"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gmail</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your Google inbox so Bran can sync recent mail, just like Calendar / Meet.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" />
              Gmail connection
            </CardTitle>
            <CardDescription>
              Bran uses read-only Gmail access. Tokens are encrypted at rest.
            </CardDescription>
          </div>
          {statusLoading ? (
            <Skeleton className="h-8 w-28" />
          ) : connected ? (
            <Badge
              variant="outline"
              className={cn(
                hasError
                  ? "border-red-700/25 bg-red-500/15 text-red-800 dark:bg-red-600/20 dark:text-red-400"
                  : "border-emerald-700/20 bg-emerald-500/15 text-emerald-800 dark:bg-emerald-600/20 dark:text-emerald-400"
              )}
            >
              {hasError ? "Error — retry sync" : "Connected"}
            </Badge>
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {statusLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : connected ? (
            <>
              <div className="grid gap-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Account:</span>{" "}
                  {status?.oauthEmail || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Last synced:</span>{" "}
                  {formatDateTime(status?.lastSyncedAt)}
                </p>
                {hasError && status?.errorMessage ? (
                  <p className="text-sm text-red-600 dark:text-red-400">{status.errorMessage}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSync} disabled={syncing}>
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Sync now
                </Button>
                <Button variant="outline" onClick={handleDisconnect} disabled={disconnecting}>
                  {disconnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Unplug className="h-4 w-4" />
                  )}
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Connect Gmail
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div>
            <CardTitle className="text-base">Synced messages</CardTitle>
            <CardDescription>Recent mail pulled from your connected inbox.</CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search subject, from, snippet…"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSearch()
              }}
            />
            <Button variant="outline" onClick={() => void handleSearch()} disabled={messagesLoading}>
              Search
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {messagesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {connected
                ? "No synced messages yet. Click Sync now after connecting."
                : "Connect Gmail to start syncing messages."}
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>From</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((message) => (
                    <TableRow
                      key={message.id}
                      className="cursor-pointer"
                      onClick={() =>
                        setExpandedId((current) => (current === message.id ? null : message.id))
                      }
                    >
                      <TableCell className="max-w-[180px] truncate text-sm">
                        {message.fromAddress || "—"}
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <div className="truncate text-sm font-medium">
                          {message.subject || "(no subject)"}
                        </div>
                        {expandedId === message.id ? (
                          <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                            {message.snippet || message.bodyText || "—"}
                          </p>
                        ) : (
                          <p className="truncate text-xs text-muted-foreground">
                            {message.snippet || "—"}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(message.receivedAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{message.isRead ? "Read" : "Unread"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
