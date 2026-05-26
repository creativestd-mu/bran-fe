import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Background,
  ControlButton,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import {
  CheckCircle2,
  Coins,
  FileCheck,
  Lock,
  Maximize2,
  Minimize2,
  MousePointerClick,
  Plus,
  Sparkles,
  UsersRound,
} from "lucide-react"
import type { Content, ContentNode, NodeStatus } from "@/types"
import {
  APPROVAL_BADGE,
  NODE_STATUS_BADGE,
  pretty,
} from "@/components/contents/contentMeta"
import { NodeDetailDialog } from "@/components/contents/NodeDetailDialog"
import { AddNodeDialog } from "@/components/contents/AddNodeDialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface Props {
  content: Content
  canReview: boolean
  initialOpenNodeId?: string | null
}

const NODE_WIDTH = 260
const COLUMN_GAP = 80

const STATUS_BORDER: Record<NodeStatus, string> = {
  PENDING: "rgba(148,163,184,0.6)",
  IN_PROGRESS: "rgba(59,130,246,0.85)",
  BLOCKED: "rgba(239,68,68,0.9)",
  COMPLETED: "rgba(16,185,129,0.85)",
}
const STATUS_GLOW: Record<NodeStatus, string> = {
  PENDING: "rgba(148,163,184,0.18)",
  IN_PROGRESS: "rgba(59,130,246,0.22)",
  BLOCKED: "rgba(239,68,68,0.22)",
  COMPLETED: "rgba(16,185,129,0.22)",
}

interface CanvasNodeData extends Record<string, unknown> {
  node: ContentNode
  index: number
  onOpen: (nodeId: string) => void
}

type ChipNode = Node<CanvasNodeData>

function NodeChip({ data }: NodeProps<ChipNode>) {
  const node = data.node
  const approved = node.outputs.find((o) => o.approvalState === "APPROVED")
  const latestOutput = node.outputs[0] ?? null
  const border = STATUS_BORDER[node.status]
  const glow = STATUS_GLOW[node.status]

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => data.onOpen(node.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          data.onOpen(node.id)
        }
      }}
      className="group relative w-[260px] cursor-pointer rounded-xl border-2 bg-card p-3 text-left shadow-md transition-transform hover:-translate-y-0.5 hover:shadow-lg"
      style={{ borderColor: border, boxShadow: `0 0 0 1px ${glow}, 0 6px 16px rgba(0,0,0,0.25)` }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-card"
        style={{ background: border }}
      />

      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums text-foreground"
            style={{ background: glow, borderColor: border }}
          >
            {data.index + 1}
          </div>
          <Badge variant="outline" className="truncate text-[10px] uppercase tracking-wider">
            {pretty(node.kind)}
          </Badge>
        </div>
        <Badge variant={NODE_STATUS_BADGE[node.status]} className="shrink-0 text-[10px]">
          {pretty(node.status)}
        </Badge>
      </div>

      <h3 className="truncate text-sm font-semibold leading-tight">{node.name}</h3>

      {approved ? (
        <div className="mt-2 flex items-center gap-1.5 truncate rounded-md border border-emerald-600/40 bg-emerald-500/10 px-2 py-1 text-[11px]">
          <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
          <span className="truncate font-medium text-emerald-500">v{approved.version}</span>
          <span className="truncate text-muted-foreground">{approved.label}</span>
        </div>
      ) : latestOutput ? (
        <div className="mt-2 flex items-center gap-1.5 truncate rounded-md border border-border bg-background/50 px-2 py-1 text-[11px]">
          <Badge variant={APPROVAL_BADGE[latestOutput.approvalState]} className="text-[9px]">
            {pretty(latestOutput.approvalState)}
          </Badge>
          <span className="truncate text-muted-foreground">v{latestOutput.version}</span>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" /> No outputs yet
        </div>
      )}

      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <FileCheck className="h-3 w-3" /> {node.outputs.length}
        </span>
        <span className="inline-flex items-center gap-1">
          <UsersRound className="h-3 w-3" /> {node.team.length}
        </span>
        <span className="inline-flex items-center gap-1">
          <Coins className="h-3 w-3" /> {node.resources.length}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] opacity-0 transition-opacity group-hover:opacity-100">
          <MousePointerClick className="h-3 w-3" /> Open
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-card"
        style={{ background: border }}
      />
    </div>
  )
}

const nodeTypes = { contentNode: NodeChip }

function defaultPosition(index: number) {
  return { x: index * (NODE_WIDTH + COLUMN_GAP), y: 0 }
}

function ContentCanvasInner({ content, canReview, initialOpenNodeId }: Props) {
  const [openNodeId, setOpenNodeId] = useState<string | null>(initialOpenNodeId ?? null)
  const [addOpen, setAddOpen] = useState(false)
  const initialNodeRef = useRef(initialOpenNodeId ?? null)

  useEffect(() => {
    if (!initialOpenNodeId) return
    if (initialNodeRef.current === initialOpenNodeId) return
    initialNodeRef.current = initialOpenNodeId
    setOpenNodeId(initialOpenNodeId)
  }, [initialOpenNodeId])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [nodes, setNodes] = useState<ChipNode[]>([])

  const flowRef = useRef<ReactFlowInstance<ChipNode, Edge> | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const lastFitSignatureRef = useRef<string>("")
  const openNode = useCallback((nodeId: string) => setOpenNodeId(nodeId), [])

  const fitViewOptions = useMemo(
    () => ({ padding: 0.25, minZoom: 0.2, maxZoom: 1, duration: 250 }),
    []
  )

  // Sync nodes from content data only when the underlying ids/order/data change.
  // Positions for nodes that already exist on the canvas are preserved so that
  // dragging doesn't get clobbered by re-renders triggered by react-query refetches.
  useEffect(() => {
    setNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]))
      return content.nodes.map((node, index) => {
        const existing = prevById.get(node.id)
        return {
          id: node.id,
          type: "contentNode",
          position: existing?.position ?? defaultPosition(index),
          draggable: true,
          data: { node, index, onOpen: openNode },
        }
      })
    })
  }, [content.nodes, openNode])

  const onNodesChange = useCallback((changes: NodeChange<ChipNode>[]) => {
    setNodes((prev) => applyNodeChanges(changes, prev))
  }, [])

  const flowEdges = useMemo<Edge[]>(() => {
    const edges: Edge[] = []
    for (let i = 1; i < content.nodes.length; i++) {
      const prev = content.nodes[i - 1]
      const curr = content.nodes[i]
      const hasApproved = prev.outputs.some((o) => o.approvalState === "APPROVED")
      const color = hasApproved ? "rgba(16,185,129,0.85)" : "rgba(148,163,184,0.55)"
      edges.push({
        id: `${prev.id}->${curr.id}`,
        source: prev.id,
        target: curr.id,
        type: "smoothstep",
        animated: hasApproved,
        style: {
          stroke: color,
          strokeWidth: 2,
          strokeDasharray: hasApproved ? undefined : "6 6",
        },
        markerEnd: { type: MarkerType.ArrowClosed, color },
        label: hasApproved ? "approved input" : "no input",
        labelStyle: { fill: color, fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: "rgba(0,0,0,0.6)", fillOpacity: 0.7 },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
        focusable: false,
        selectable: false,
      })
    }
    return edges
  }, [content.nodes])

  const autoLayout = useCallback(() => {
    setNodes((prev) =>
      prev.map((n, index) => ({ ...n, position: defaultPosition(index) }))
    )
    setTimeout(() => flowRef.current?.fitView(fitViewOptions), 60)
  }, [fitViewOptions])

  // Refit whenever the set of node ids changes (initial load + add/remove).
  // Uses a couple of rAFs to ensure react-flow has measured node sizes.
  useEffect(() => {
    if (nodes.length === 0) return
    const signature = nodes.map((n) => n.id).join("|")
    if (lastFitSignatureRef.current === signature) return

    let cancelled = false
    let raf1 = 0
    let raf2 = 0
    const run = () => {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          if (cancelled || !flowRef.current) return
          flowRef.current.fitView({ ...fitViewOptions, duration: 0 })
          lastFitSignatureRef.current = signature
        })
      })
    }
    run()
    return () => {
      cancelled = true
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [nodes, fitViewOptions])

  // Refit on container resize (fullscreen toggle, window resize, sidebar, etc.).
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    let timer: number | undefined
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        flowRef.current?.fitView(fitViewOptions)
      }, 80)
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [fitViewOptions])

  const toggleFullscreen = useCallback(() => setIsFullscreen((v) => !v), [])

  useEffect(() => {
    if (!isFullscreen) return
    const original = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const refit = setTimeout(() => flowRef.current?.fitView(fitViewOptions), 60)
    return () => {
      document.body.style.overflow = original
      clearTimeout(refit)
    }
  }, [isFullscreen, fitViewOptions])

  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isFullscreen])

  const nextOrderIndex =
    content.nodes.length === 0
      ? 0
      : Math.max(...content.nodes.map((n) => n.orderIndex)) + 1

  const openNodeData = openNodeId ? content.nodes.find((n) => n.id === openNodeId) ?? null : null
  const openIndex = openNodeData ? content.nodes.findIndex((n) => n.id === openNodeData.id) : -1

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 flex flex-col gap-3 bg-background p-4" : "space-y-3"}>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2.5">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={autoLayout}>
          <Sparkles className="h-3.5 w-3.5" /> Auto layout
        </Button>
        <span className="text-xs text-muted-foreground">
          Click any node to open its details. Drag to rearrange.
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add node
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className={
          isFullscreen
            ? "relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-background"
            : "relative h-[70vh] overflow-hidden rounded-lg border border-border bg-background"
        }
      >
        {content.nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-medium text-accent">No workflow nodes yet</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Add the first stage of this workflow. Each node represents one step (script, shoot, edit, etc.).
            </p>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onInit={(instance) => {
            flowRef.current = instance
            requestAnimationFrame(() => instance.fitView(fitViewOptions))
          }}
          fitView
          fitViewOptions={fitViewOptions}
          minZoom={0.2}
          maxZoom={1.5}
          nodesConnectable={false}
          nodesDraggable
          edgesFocusable={false}
          elementsSelectable={false}
          panOnDrag
          panOnScroll={false}
          zoomOnScroll
          proOptions={{ hideAttribution: true }}
        >
          <Controls
            showFitView
            showInteractive={false}
            className="!border-border !bg-card !shadow-md [&>button]:!border-border [&>button]:!bg-card [&>button]:!text-foreground [&>button:hover]:!bg-muted"
          >
            <ControlButton
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </ControlButton>
          </Controls>
          <Background color="rgba(139, 112, 62, 0.08)" gap={24} />
        </ReactFlow>
      </div>

      <AddNodeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        contentId={content.id}
        defaultOrderIndex={nextOrderIndex}
      />

      {openNodeData && (
        <NodeDetailDialog
          open={Boolean(openNodeId)}
          onOpenChange={(open) => {
            if (!open) setOpenNodeId(null)
          }}
          node={openNodeData}
          content={content}
          index={openIndex}
          canReview={canReview}
        />
      )}
    </div>
  )
}

export function ContentCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <ContentCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
