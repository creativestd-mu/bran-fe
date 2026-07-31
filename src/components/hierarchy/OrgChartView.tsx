import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { toPng } from "html-to-image"
import {
  ChevronDown,
  ChevronRight,
  Download,
  Maximize2,
  Minimize2,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Users,
  X,
} from "lucide-react"
import { toast } from "sonner"
import type { HierarchyKind, HierarchyMember } from "@/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatRoleLabel } from "@/lib/utils"
import "./orgChart.css"

interface OrgChartViewProps {
  members: HierarchyMember[]
  kind: HierarchyKind
  onEdit?: () => void
}

interface OrgNode {
  id: string
  member: HierarchyMember
  children: OrgNode[]
  depth: number
  descendantCount: number
}

const LEVEL_ACCENTS = ["#d4af37", "#c79a2f", "#a97f3a", "#8b703e", "#6b5638"]

const MIN_ZOOM = 0.4
const MAX_ZOOM = 1.5
const ZOOM_STEP = 0.1

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function buildForest(members: HierarchyMember[]): {
  roots: OrgNode[]
  parentOf: Map<string, string>
  nodeIds: string[]
} {
  const byUserId = new Map(members.map((m) => [m.userId, m]))
  const childrenByParent = new Map<string, HierarchyMember[]>()
  const rootMembers: HierarchyMember[] = []

  for (const member of members) {
    const parentUserId = member.reportsToUserId
    if (parentUserId && byUserId.has(parentUserId) && parentUserId !== member.userId) {
      const list = childrenByParent.get(parentUserId) ?? []
      list.push(member)
      childrenByParent.set(parentUserId, list)
    } else {
      rootMembers.push(member)
    }
  }

  const parentOf = new Map<string, string>()
  const nodeIds: string[] = []
  const seen = new Set<string>()

  const build = (member: HierarchyMember, depth: number, parentId: string | null): OrgNode => {
    seen.add(member.userId)
    nodeIds.push(member.id)
    if (parentId) parentOf.set(member.id, parentId)

    const kids = (childrenByParent.get(member.userId) ?? [])
      .filter((child) => !seen.has(child.userId))
      .sort((a, b) => a.user.name.localeCompare(b.user.name))
      .map((child) => build(child, depth + 1, member.id))

    const descendantCount = kids.reduce((sum, kid) => sum + 1 + kid.descendantCount, 0)
    return { id: member.id, member, children: kids, depth, descendantCount }
  }

  const roots = rootMembers
    .sort((a, b) => a.user.name.localeCompare(b.user.name))
    .map((member) => build(member, 0, null))

  return { roots, parentOf, nodeIds }
}

export function OrgChartView({ members, kind, onEdit }: OrgChartViewProps) {
  const { roots, parentOf, nodeIds } = useMemo(() => buildForest(members), [members])

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [zoom, setZoom] = useState(0.85)
  const [query, setQuery] = useState("")
  const [isFullscreen, setIsFullscreen] = useState(false)

  const shellRef = useRef<HTMLDivElement>(null)
  const treeRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Start focused: show top level + their direct reports, collapse everything deeper.
  useEffect(() => {
    const initial = new Set<string>()
    const walk = (node: OrgNode) => {
      if (node.depth >= 1 && node.children.length > 0) initial.add(node.id)
      node.children.forEach(walk)
    }
    roots.forEach(walk)
    setCollapsed(initial)
  }, [roots])

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const expandAll = useCallback(() => setCollapsed(new Set()), [])
  const collapseAll = useCallback(() => {
    const all = new Set<string>()
    const walk = (node: OrgNode) => {
      if (node.children.length > 0) all.add(node.id)
      node.children.forEach(walk)
    }
    // Keep roots open so the top level is always visible.
    roots.forEach((root) => root.children.forEach(walk))
    setCollapsed(all)
  }, [roots])

  const normalizedQuery = query.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!normalizedQuery) return new Set<string>()
    const set = new Set<string>()
    const walk = (node: OrgNode) => {
      const user = node.member.user
      const haystack = `${user.name} ${user.designation ?? ""} ${user.email ?? ""}`.toLowerCase()
      if (haystack.includes(normalizedQuery)) set.add(node.id)
      node.children.forEach(walk)
    }
    roots.forEach(walk)
    return set
  }, [normalizedQuery, roots])

  // Expand ancestors of every match, then scroll the first match into view.
  useEffect(() => {
    if (matches.size === 0) return
    setCollapsed((prev) => {
      const next = new Set(prev)
      matches.forEach((id) => {
        let cursor = parentOf.get(id)
        while (cursor) {
          next.delete(cursor)
          cursor = parentOf.get(cursor)
        }
      })
      return next
    })
    const firstMatch = nodeIds.find((id) => matches.has(id))
    if (firstMatch) {
      window.setTimeout(() => {
        cardRefs.current.get(firstMatch)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" })
      }, 80)
    }
  }, [matches, parentOf, nodeIds])

  const zoomIn = useCallback(() => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2))), [])
  const zoomOut = useCallback(() => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2))), [])
  const resetZoom = useCallback(() => setZoom(0.85), [])

  const toggleFullscreen = useCallback(() => setIsFullscreen((v) => !v), [])

  useEffect(() => {
    if (!isFullscreen) return
    const original = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = original
      window.removeEventListener("keydown", onKey)
    }
  }, [isFullscreen])

  const exportPng = useCallback(async () => {
    if (!treeRef.current) return
    try {
      const cardBg = getComputedStyle(document.documentElement).getPropertyValue("--card").trim() || "#1a110e"
      const dataUrl = await toPng(treeRef.current, {
        cacheBust: true,
        backgroundColor: cardBg,
        pixelRatio: 2,
      })
      const link = document.createElement("a")
      link.download = `${kind}-org-chart-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } catch {
      toast.error("Failed to export PNG")
    }
  }, [kind])

  const totalPeople = nodeIds.length

  const renderNode = (node: OrgNode) => {
    const isCollapsed = collapsed.has(node.id)
    const hasChildren = node.children.length > 0
    const accent = LEVEL_ACCENTS[Math.min(node.depth, LEVEL_ACCENTS.length - 1)]
    const user = node.member.user
    const isPlaceholder = Boolean(user.isPlaceholder)
    const isMatch = matches.has(node.id)
    const roleLabel =
      kind === "user" ? formatRoleLabel(user.role?.name) || "Member" : formatRoleLabel(node.member.memberRole)

    return (
      <li key={node.id}>
        <div
          ref={(el) => {
            if (el) cardRefs.current.set(node.id, el)
            else cardRefs.current.delete(node.id)
          }}
          className="relative flex w-[220px] flex-col rounded-xl border bg-card px-3 py-2.5 text-left shadow-md transition"
          style={{
            borderColor: isMatch ? "#f5d97a" : accent,
            borderStyle: isPlaceholder ? "dashed" : "solid",
            boxShadow: isMatch
              ? "0 0 0 2px rgba(245,217,122,0.45), 0 6px 16px rgba(0,0,0,0.3)"
              : `0 0 0 1px ${accent}22, 0 4px 12px rgba(0,0,0,0.25)`,
          }}
        >
          <div className="flex items-center gap-2.5">
            <Avatar className="h-10 w-10 shrink-0 border border-border">
              <AvatarImage src={user.avatarUrl ?? undefined} />
              <AvatarFallback className="text-xs">{isPlaceholder ? "+" : initials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {user.designation || (isPlaceholder ? "Open role" : "\u2014")}
              </p>
            </div>
            <span
              className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${user.isActive ? "bg-green-500" : "bg-muted-foreground"}`}
              title={user.isActive ? "Active" : "Inactive"}
            />
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <Badge
              variant="outline"
              className="max-w-[120px] truncate text-[10px] capitalize"
              style={{ borderColor: `${accent}66`, color: accent }}
            >
              {roleLabel}
            </Badge>
            {hasChildren && (
              <button
                type="button"
                onClick={() => toggle(node.id)}
                className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                title={isCollapsed ? `Expand ${node.descendantCount} reports` : "Collapse"}
              >
                {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                <Users className="h-3 w-3" />
                {node.children.length}
              </button>
            )}
          </div>

          {hasChildren && isCollapsed && node.descendantCount > node.children.length && (
            <span
              className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card px-1.5 text-[9px] text-muted-foreground"
              title={`${node.descendantCount} total in this branch`}
            >
              +{node.descendantCount}
            </span>
          )}
        </div>

        {hasChildren && !isCollapsed && <ul>{node.children.map(renderNode)}</ul>}
      </li>
    )
  }

  const toolbar = (
    <div
      className={
        isFullscreen
          ? "flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2"
          : "flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2.5"
      }
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a person..."
          className="h-8 w-44 pl-8 pr-7 text-sm"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={expandAll}>
          <ChevronDown className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Expand all</span>
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={collapseAll}>
          <ChevronRight className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Collapse</span>
        </Button>
      </div>

      <div className="flex items-center gap-0.5 rounded-md border border-border">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={zoomOut} title="Zoom out">
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <button
          type="button"
          onClick={resetZoom}
          className="min-w-[3rem] px-1 text-center text-xs tabular-nums text-muted-foreground hover:text-foreground"
          title="Reset zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={zoomIn} title="Zoom in">
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={resetZoom} title="Reset zoom">
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <span className="ml-1 hidden text-xs text-muted-foreground sm:inline">{totalPeople} people</span>

      <div className="ml-auto flex items-center gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={exportPng}>
          <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Export</span>
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={toggleFullscreen}>
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{isFullscreen ? "Exit" : "Fullscreen"}</span>
        </Button>
        {onEdit && (
          <Button size="sm" className="gap-1.5" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Edit chart</span>
          </Button>
        )}
      </div>
    </div>
  )

  const stage = (
    <div
      className={
        isFullscreen
          ? "relative min-h-0 flex-1 overflow-auto bg-background"
          : "relative h-[60vh] min-h-[320px] overflow-auto rounded-lg border border-border bg-background lg:h-[74vh]"
      }
      style={{
        backgroundImage: "radial-gradient(rgba(139,112,62,0.10) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      {totalPeople === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm font-medium text-accent">No one on this chart yet</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Switch to Edit to drag people in and draw reporting lines.
          </p>
        </div>
      ) : (
        <div className="min-h-full min-w-full p-6">
          <div ref={treeRef} className="org-tree" style={{ transform: `scale(${zoom})` }}>
            <ul>{roots.map(renderNode)}</ul>
          </div>
        </div>
      )}
    </div>
  )

  const content = (
    <div
      ref={shellRef}
      className={
        isFullscreen
          ? "fixed inset-0 z-[100] flex h-screen w-screen flex-col overflow-hidden bg-background"
          : "space-y-3"
      }
    >
      {toolbar}
      {stage}
    </div>
  )

  return isFullscreen ? createPortal(content, document.body) : content
}
