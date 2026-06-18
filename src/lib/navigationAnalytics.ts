import { navigationApi } from "@/lib/api"
import type { MostVisitedPage } from "@/types"

export function logNavSearchQuery(query: string, selectedPath?: string) {
  const trimmed = query.trim()
  if (!trimmed) return
  navigationApi
    .logSearch({ query: trimmed.slice(0, 500), selectedPath })
    .catch(() => {})
}

export function recordPageVisit(path: string) {
  if (!path.startsWith("/")) return
  navigationApi.recordPageVisit({ path: path.slice(0, 500) }).catch(() => {})
}

export function mergeMostVisitedPage(
  pages: MostVisitedPage[],
  update: MostVisitedPage
): MostVisitedPage[] {
  const rest = pages.filter((p) => p.path !== update.path)
  return [update, ...rest]
    .sort(
      (a, b) =>
        b.visitCount - a.visitCount ||
        new Date(b.lastVisitedAt).getTime() - new Date(a.lastVisitedAt).getTime()
    )
    .slice(0, 10)
}
