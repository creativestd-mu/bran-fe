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
import { cn, formatRoleLabel } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/useMediaQuery"
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

const LEVEL_ACCENTS = ["#d4af37", "#c9a84f", "#9f8a5e", "#7f735a", "#686155"]

const MIN_ZOOM = 0.4
const MAX_ZOOM = 1.5
const ZOOM_STEP = 0.1
const DEFAULT_ZOOM = 1

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
  const isDesktop = useMediaQuery("(min-width: 768px)")

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
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
  const resetZoom = useCallback(() => setZoom(DEFAULT_ZOOM), [])

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
  const activePeople = members.filter((member) => member.user.isActive && !member.user.isPlaceholder).length
  const openRoles = members.filter((member) => member.user.isPlaceholder).length

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
          className="org-person-card relative flex w-[236px] flex-col rounded-2xl border bg-card/95 p-3.5 text-left transition"
          style={{
            borderColor: isMatch ? "#f5d97a" : `${accent}55`,
            borderStyle: isPlaceholder ? "dashed" : "solid",
            boxShadow: isMatch
              ? "0 0 0 2px rgba(245,217,122,0.38), 0 12px 32px rgba(0,0,0,0.22)"
              : "0 10px 30px rgba(0,0,0,0.14)",
          }}
        >
          <span
            className="absolute inset-x-5 top-0 h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
          />
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11 shrink-0 border border-border/70 ring-2 ring-background">
              <AvatarImage src={user.avatarUrl ?? undefined} />
              <AvatarFallback className="text-xs">{isPlaceholder ? "+" : initials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-semibold leading-tight">{user.name}</p>
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${user.isActive ? "bg-emerald-500" : "bg-muted-foreground/50"}`}
                  title={user.isActive ? "Active" : "Inactive"}
                />
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {user.designation || (isPlaceholder ? "Open role" : "\u2014")}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/50 pt-2.5">
            <Badge
              variant="outline"
              className="max-w-[136px] truncate border-border/60 bg-muted/30 text-[10px] font-medium capitalize text-muted-foreground"
            >
              {roleLabel}
            </Badge>
            {hasChildren && (
              <button
                type="button"
                onClick={() => toggle(node.id)}
                className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-3 text-xs font-semibold text-accent transition hover:bg-accent/20"
                title={isCollapsed ? `Expand ${node.descendantCount} reports` : "Collapse"}
              >
                {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {node.children.length}
                <span className="font-normal opacity-80">report{node.children.length === 1 ? "" : "s"}</span>
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

  const renderMobileNode = (node: OrgNode) => {
    const isCollapsed = collapsed.has(node.id)
    const hasChildren = node.children.length > 0
    const user = node.member.user
    const isPlaceholder = Boolean(user.isPlaceholder)
    const isMatch = matches.has(node.id)
    const accent = LEVEL_ACCENTS[Math.min(node.depth, LEVEL_ACCENTS.length - 1)]
    const roleLabel =
      kind === "user" ? formatRoleLabel(user.role?.name) || "Member" : formatRoleLabel(node.member.memberRole)

    return (
      <div key={node.id} className="relative">
        <div
          className={cn(
            "org-mobile-row relative flex min-h-16 items-center gap-3 rounded-2xl border bg-card/80 p-3",
            isMatch && "ring-2 ring-accent/50"
          )}
          style={{
            marginLeft: `${Math.min(node.depth * 14, 42)}px`,
            borderColor: isPlaceholder ? `${accent}77` : undefined,
            borderStyle: isPlaceholder ? "dashed" : "solid",
          }}
          ref={(el) => {
            if (el) cardRefs.current.set(node.id, el)
            else cardRefs.current.delete(node.id)
          }}
        >
          {node.depth > 0 && (
            <span
              aria-hidden
              className="absolute -left-3 top-1/2 h-px w-3"
              style={{ backgroundColor: `${accent}66` }}
            />
          )}
          <Avatar className="h-10 w-10 shrink-0 border border-border/60">
            <AvatarImage src={user.avatarUrl ?? undefined} />
            <AvatarFallback className="text-xs">{isPlaceholder ? "+" : initials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${user.isActive ? "bg-emerald-500" : "bg-muted-foreground/50"}`}
              />
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {user.designation || (isPlaceholder ? "Open role" : roleLabel)}
            </p>
            <p className="mt-1 truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
              {roleLabel}
            </p>
          </div>
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggle(node.id)}
              className="flex h-11 min-w-[60px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-accent/25 bg-accent/10 px-2.5 text-accent transition active:scale-95"
              aria-label={isCollapsed ? `Show reports for ${user.name}` : `Hide reports for ${user.name}`}
            >
              <span className="flex items-center gap-1 text-sm font-bold leading-none tabular-nums">
                {node.children.length}
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
              <span className="text-[9px] font-medium uppercase leading-none tracking-wide text-accent/70">
                {node.children.length === 1 ? "report" : "reports"}
              </span>
            </button>
          ) : (
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: `${accent}88` }} />
          )}
        </div>
        {hasChildren && !isCollapsed && (
          <div
            className="org-mobile-children relative mt-2 space-y-2"
            style={{ ["--mobile-line-x" as string]: `${Math.min(node.depth * 14 + 8, 50)}px` }}
          >
            {node.children.map(renderMobileNode)}
          </div>
        )}
      </div>
    )
  }

  const toolbar = (
    <div
      className={
        isFullscreen
          ? "shrink-0 border-b border-border/60 bg-background/95 p-3 backdrop-blur"
          : "rounded-2xl border border-border/60 bg-card/55 p-3 shadow-sm"
      }
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <div className="hidden h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent sm:flex">
            <Users className="h-4 w-4" />
          </div>
          <div className="hidden min-w-28 sm:block">
            <p className="text-sm font-semibold">Organisation</p>
            <p className="text-xs text-muted-foreground">{totalPeople} positions</p>
          </div>
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a person or role"
              className="h-9 w-full rounded-xl bg-background/70 pl-9 pr-8 text-sm sm:w-56"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 lg:ml-auto">
          <Button size="sm" variant="ghost" className="shrink-0 gap-1.5" onClick={expandAll}>
            <ChevronDown className="h-3.5 w-3.5" /> Expand
          </Button>
          <Button size="sm" variant="ghost" className="shrink-0 gap-1.5" onClick={collapseAll}>
            <ChevronRight className="h-3.5 w-3.5" /> Collapse
          </Button>

          {isDesktop && (
            <div className="ml-1 flex shrink-0 items-center gap-0.5 rounded-xl border border-border/60 bg-background/50 p-0.5">
              <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={zoomOut} title="Zoom out">
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <button
                type="button"
                onClick={resetZoom}
                className="min-w-11 px-1 text-center text-[11px] tabular-nums text-muted-foreground hover:text-foreground"
                title="Reset zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={zoomIn} title="Zoom in">
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={resetZoom} title="Reset zoom">
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={exportPng} title="Export image">
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={toggleFullscreen} title="Fullscreen">
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          {onEdit && (
            <Button size="sm" className="ml-1 shrink-0 gap-1.5 rounded-xl" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
        </div>
      </div>
    </div>
  )

  const stage = (
    <div
      className={
        isFullscreen
          ? "relative min-h-0 flex-1 overflow-auto bg-background"
          : "relative min-h-[320px] overflow-auto rounded-2xl border border-border/60 bg-background sm:h-[64vh] lg:h-[74vh]"
      }
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-accent/[0.035] to-transparent"
      />
      {totalPeople === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No one on this chart yet</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Switch to Edit to drag people in and draw reporting lines.
          </p>
        </div>
      ) : isDesktop ? (
        <div className="relative min-h-full min-w-full p-8">
          <div ref={treeRef} className="org-tree" style={{ transform: `scale(${zoom})` }}>
            <ul>{roots.map(renderNode)}</ul>
          </div>
        </div>
      ) : (
        <div ref={treeRef} className="relative space-y-4 p-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border/50 bg-card/55 p-2.5">
              <p className="text-lg font-semibold tabular-nums">{totalPeople}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Positions</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-card/55 p-2.5">
              <p className="text-lg font-semibold tabular-nums">{activePeople}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Active</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-card/55 p-2.5">
              <p className="text-lg font-semibold tabular-nums">{openRoles}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Open roles</p>
            </div>
          </div>
          <div className="space-y-2">
            {roots.map(renderMobileNode)}
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
