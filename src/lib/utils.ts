import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format snake_case / lowercase labels as Title Case (e.g. chief_of_staff → Chief Of Staff). */
export function formatRoleLabel(name: string | null | undefined): string {
  if (!name) return ""
  return name
    .replace(/_/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
}

/** Compact relative time (e.g. "just now", "3h ago"). */
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return "—"
  const diffSec = Math.round((Date.now() - then) / 1000)
  if (diffSec < 45) return "just now"
  if (diffSec < 90) return "1m ago"
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`
  if (diffSec < 5400) return "1h ago"
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`
  if (diffSec < 172800) return "1d ago"
  return `${Math.round(diffSec / 86400)}d ago`
}
