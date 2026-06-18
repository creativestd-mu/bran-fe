import { useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { navigationApi } from "@/lib/api"
import { mergeMostVisitedPage } from "@/lib/navigationAnalytics"

const SKIP_PATHS = new Set(["/login", "/forbidden"])

export function usePageVisitTracking() {
  const { pathname } = useLocation()
  const { user, setMostVisitedPages } = useAuth()
  const lastTracked = useRef<string | null>(null)

  useEffect(() => {
    if (!user || SKIP_PATHS.has(pathname) || lastTracked.current === pathname) return
    lastTracked.current = pathname

    navigationApi
      .recordPageVisit({ path: pathname })
      .then((page) => setMostVisitedPages((prev) => mergeMostVisitedPage(prev, page)))
      .catch(() => {})
  }, [pathname, user, setMostVisitedPages])
}
