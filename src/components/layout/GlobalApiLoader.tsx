import { useEffect, useState } from "react"
import { getActiveRequestsCount, subscribeToNetworkActivity } from "@/lib/networkActivity"

export function GlobalApiLoader() {
  const [activeRequests, setActiveRequests] = useState(() => getActiveRequestsCount())

  useEffect(() => subscribeToNetworkActivity(setActiveRequests), [])

  if (activeRequests === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100]">
      <div className="h-0.5 w-full animate-pulse bg-gradient-to-r from-primary/20 via-primary to-primary/20 shadow-[0_0_10px_rgba(212,175,55,0.6)]" />
    </div>
  )
}
