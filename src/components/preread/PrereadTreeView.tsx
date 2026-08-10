import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  MessageSquare,
  Minus,
  Plus,
  RotateCcw,
  ScrollText,
} from "lucide-react"
import type { PrereadNodeKind, PrereadTreeNode } from "@/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { cn } from "@/lib/utils"
import "./preread.css"

const KIND_LABELS: Record<PrereadNodeKind, string> = {
  output: "Output",
  blocker: "Blocker",
  advice: "Recommendations",
}

const MIN_ZOOM = 0.45
const MAX_ZOOM = 1.35
const ZOOM_STEP = 0.1
const MAX_TITLE_CHARS = 40

function truncateTitle(title: string) {
  if (title.length <= MAX_TITLE_CHARS) return title
  return `${title.slice(0, MAX_TITLE_CHARS).trimEnd()}…`
}

interface PrereadTreeViewProps {
  tree: PrereadTreeNode[]
  selectedNodeId: string | null
  onSelectNode: (node: PrereadTreeNode) => void
}

function countDescendants(node: PrereadTreeNode): number {
  return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0)
}

function sortTree(nodes: PrereadTreeNode[]): PrereadTreeNode[] {
  return [...nodes]
    .sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt))
    .map((node) => ({ ...node, children: sortTree(node.children) }))
}

function MapCard({
  node,
  selected,
  collapsed,
  onSelect,
  onToggle,
}: {
  node: PrereadTreeNode
  selected: boolean
  collapsed: boolean
  onSelect: () => void
  onToggle: () => void
}) {
  const hasChildren = node.children.length > 0
  const descendants = hasChildren ? countDescendants(node) : 0

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn("preread-map-card", `kind-${node.kind}`, selected && "selected")}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      <span className="preread-map-card-accent" />
      {hasChildren && collapsed && descendants > node.children.length && (
        <span className="preread-map-collapsed-hint">+{descendants - node.children.length}</span>
      )}
      <div className="preread-map-card-content">
        <p className="preread-map-title" title={node.title.length > MAX_TITLE_CHARS ? node.title : undefined}>
          {truncateTitle(node.title)}
        </p>
        <div className="preread-map-meta">
          <span className="preread-map-meta-item" title="Comments">
            <MessageSquare className="h-3 w-3" />
            {node.comments.length}
          </span>
          <span className="preread-map-meta-item" title="Media">
            <ImageIcon className="h-3 w-3" />
            {node.media.length}
          </span>
        </div>
      </div>
      {hasChildren && (
        <button
          type="button"
          className="preread-map-expand"
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          title={collapsed ? `Expand ${descendants} below` : "Collapse"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <span>{node.children.length} nested</span>
        </button>
      )}
    </div>
  )
}

function MobileNode({
  node,
  selected,
  collapsed,
  onSelect,
  onToggle,
}: {
  node: PrereadTreeNode
  selected: boolean
  collapsed: boolean
  onSelect: () => void
  onToggle: () => void
}) {
  const hasChildren = node.children.length > 0

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn("preread-mobile-row", `kind-${node.kind}`, selected && "selected")}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      <span className="preread-mobile-row-accent" />
      <div className="min-w-0 flex-1">
        <p
          className="preread-mobile-title"
          title={node.title.length > MAX_TITLE_CHARS ? node.title : undefined}
        >
          {truncateTitle(node.title)}
        </p>
        <div className="preread-map-meta">
          <span className="preread-map-meta-item" title="Comments">
            <MessageSquare className="h-3 w-3" />
            {node.comments.length}
          </span>
          <span className="preread-map-meta-item" title="Media">
            <ImageIcon className="h-3 w-3" />
            {node.media.length}
          </span>
        </div>
      </div>
      {hasChildren && (
        <button
          type="button"
          className="preread-mobile-toggle"
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          aria-label={
            collapsed
              ? `Show ${node.children.length} nested under ${node.title}`
              : `Hide nested items under ${node.title}`
          }
        >
          <span className="preread-mobile-toggle-count">{node.children.length}</span>
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      )}
    </div>
  )
}

function flattenForSkim(
  nodes: PrereadTreeNode[],
  depth = 0
): { node: PrereadTreeNode; depth: number }[] {
  const out: { node: PrereadTreeNode; depth: number }[] = []
  for (const node of nodes) {
    out.push({ node, depth })
    out.push(...flattenForSkim(node.children, depth + 1))
  }
  return out
}

function SkimModal({
  open,
  onOpenChange,
  items,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: { node: PrereadTreeNode; depth: number }[]
  onSelect: (node: PrereadTreeNode) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <DialogTitle>Skim mode</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Every note in hierarchy order, with a quick summary. Click one to open it.
          </p>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No nodes yet.</p>
          ) : (
            <ol className="space-y-1.5">
              {items.map(({ node, depth }) => (
                <li key={node.id} style={{ marginLeft: depth * 20 }}>
                  <button
                    type="button"
                    className="preread-skim-item"
                    onClick={() => onSelect(node)}
                  >
                    <span className={cn("preread-skim-dot", `kind-${node.kind}`)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {KIND_LABELS[node.kind]}
                        </span>
                        {node.children.length > 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            · {node.children.length} nested
                          </span>
                        )}
                      </div>
                      <p className="truncate text-sm font-semibold text-foreground">{node.title}</p>
                      <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                        {node.description?.trim() || "No description yet."}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function PrereadTreeView({ tree, selectedNodeId, onSelectNode }: PrereadTreeViewProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const sortedTree = useMemo(() => sortTree(tree), [tree])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [zoom, setZoom] = useState(0.9)
  const [skimOpen, setSkimOpen] = useState(false)
  const skimItems = useMemo(() => flattenForSkim(sortedTree), [sortedTree])

  // Start focused: show roots + their direct children, collapse deeper branches.
  useEffect(() => {
    const initial = new Set<string>()
    const walk = (node: PrereadTreeNode, depth: number) => {
      if (depth >= 1 && node.children.length > 0) initial.add(node.id)
      node.children.forEach((child) => walk(child, depth + 1))
    }
    sortedTree.forEach((root) => walk(root, 0))
    setCollapsed(initial)
  }, [sortedTree])

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const expandAll = useCallback(() => setCollapsed(new Set()), [])
  const collapseDeep = useCallback(() => {
    const next = new Set<string>()
    const walk = (node: PrereadTreeNode, depth: number) => {
      if (depth >= 1 && node.children.length > 0) next.add(node.id)
      node.children.forEach((child) => walk(child, depth + 1))
    }
    sortedTree.forEach((root) => walk(root, 0))
    setCollapsed(next)
  }, [sortedTree])

  const renderNode = (node: PrereadTreeNode) => {
    const isCollapsed = collapsed.has(node.id)
    const hasChildren = node.children.length > 0

    return (
      <li key={node.id}>
        <MapCard
          node={node}
          selected={selectedNodeId === node.id}
          collapsed={isCollapsed}
          onSelect={() => onSelectNode(node)}
          onToggle={() => toggle(node.id)}
        />
        {hasChildren && !isCollapsed && <ul>{node.children.map(renderNode)}</ul>}
      </li>
    )
  }

  const renderMobileNode = (node: PrereadTreeNode) => {
    const isCollapsed = collapsed.has(node.id)
    const hasChildren = node.children.length > 0

    return (
      <div key={node.id} className="preread-mobile-item">
        <MobileNode
          node={node}
          selected={selectedNodeId === node.id}
          collapsed={isCollapsed}
          onSelect={() => onSelectNode(node)}
          onToggle={() => toggle(node.id)}
        />
        {hasChildren && !isCollapsed && (
          <div className="preread-mobile-children">{node.children.map(renderMobileNode)}</div>
        )}
      </div>
    )
  }

  if (sortedTree.length === 0) {
    return (
      <div className="preread-map-shell flex items-center justify-center text-sm text-muted-foreground">
        No nodes yet. Add a root node to start the map.
      </div>
    )
  }

  return (
    <div className="preread-map-shell">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/70 px-3 py-2 backdrop-blur">
        <span className="mr-1 text-xs font-medium text-muted-foreground">Map</span>
        {isDesktop && (
          <>
            <Button type="button" variant="outline" size="sm" className="h-7 px-2" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))}>
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-7 px-2" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-7 px-2" onClick={() => setZoom(0.9)}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <div className="mx-1 h-4 w-px bg-border" />
          </>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={isDesktop ? "h-7" : "h-9"}
          onClick={expandAll}
        >
          Expand all
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={isDesktop ? "h-7" : "h-9"}
          onClick={collapseDeep}
        >
          Focus top
        </Button>
        <div className="mx-1 h-4 w-px bg-border" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("gap-1.5", isDesktop ? "h-7" : "h-9")}
          onClick={() => setSkimOpen(true)}
        >
          <ScrollText className="h-3.5 w-3.5" />
          Skim mode
        </Button>
        {isDesktop && (
          <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#d4af37]" /> Output
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#e25555]" /> Blocker
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#4f8cff]" /> Recommendations
            </span>
          </div>
        )}
      </div>

      <div className="preread-map-viewport">
        {isDesktop ? (
          <div className="preread-map-tree" style={{ transform: `scale(${zoom})` }}>
            <ul>{sortedTree.map(renderNode)}</ul>
          </div>
        ) : (
          <div className="preread-mobile-list">{sortedTree.map(renderMobileNode)}</div>
        )}
      </div>

      <SkimModal
        open={skimOpen}
        onOpenChange={setSkimOpen}
        items={skimItems}
        onSelect={(node) => {
          setSkimOpen(false)
          onSelectNode(node)
        }}
      />
    </div>
  )
}

export function findTreeNode(tree: PrereadTreeNode[], nodeId: string): PrereadTreeNode | null {
  for (const node of tree) {
    if (node.id === nodeId) return node
    const found = findTreeNode(node.children, nodeId)
    if (found) return found
  }
  return null
}
