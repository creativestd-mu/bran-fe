import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react"
import { createPortal } from "react-dom"
import { toPng } from "html-to-image"
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  ControlButton,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { toast } from "sonner"
import { X, Download, Undo2, Redo2, Save, Upload, Sparkles, Maximize2, Minimize2, UserPlus } from "lucide-react"
import type { HierarchyKind, HierarchyMember, MemberRole, User } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { NodeInspector } from "./NodeInspector"
import { NEW_HIRE_DRAG_MIME, UserPalette } from "./UserPalette"
import { NewHireDialog, type NewHireFormValues } from "./NewHireDialog"
import {
  applyAutoLayout,
  buildEdgesFromMembers,
  buildNodesFromMembers,
  createHierarchyEdge,
  getManagerNodeId,
  getRootNodeIds,
  isConnectionValid,
  type HierarchyNodeData,
  validateHierarchyGraph,
  NODE_HEIGHT,
  NODE_WIDTH,
} from "./hierarchyUtils"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useHierarchySync } from "@/hooks/useHierarchySync"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { usersApi } from "@/lib/api"

interface HierarchyCanvasProps {
  kind: HierarchyKind
  contextId: string
  members: HierarchyMember[]
  users: User[]
  loading?: boolean
  allowRemove?: boolean
  onReload: () => Promise<void>
  adapter: {
    addMember: (contextId: string, data: import("@/types").HierarchyMemberPayload) => Promise<unknown>
    updateMember: (memberId: string, data: Partial<import("@/types").HierarchyMemberPayload>) => Promise<unknown>
    deleteMember: (memberId: string) => Promise<unknown>
    upsertGraph?: (
      contextId: string,
      data: {
        members: Array<{
          userId: string
          memberRole: import("@/types").HierarchyMemberPayload["memberRole"]
          reportsToUserId: string | null
        }>
      }
    ) => Promise<unknown>
  }
}

interface Snapshot {
  nodes: Node<HierarchyNodeData>[]
  edges: Edge[]
}

type CanvasNodeData = HierarchyNodeData & {
  isRoot?: boolean
  level?: number
  onRemove?: (nodeId: string) => void
  showMemberRole?: boolean
}

const LEVEL_COLORS = [
  { border: "#d4af37", glow: "rgba(212, 175, 55, 0.35)" }, // L1 - gold
  { border: "#b8860b", glow: "rgba(184, 134, 11, 0.30)" }, // L2 - dark gold
  { border: "#8b703e", glow: "rgba(139, 112, 62, 0.25)" }, // L3 - bronze
  { border: "#6b5638", glow: "rgba(107, 86, 56, 0.22)" }, // L4 - dim bronze
  { border: "#4a3f2a", glow: "rgba(74, 63, 42, 0.18)" }, // L5+
]

const DEFAULT_FIT_PADDING = 0.62
const FULLSCREEN_FIT_PADDING = 0.12
/** Default React Flow minZoom is 0.5; 0.125 allows ~300% more zoom-out. */
const MIN_ZOOM = 0.125
const MAX_ZOOM = 2.5

function HierarchyNodeCard({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const isPlaceholder = Boolean(data.user.isPlaceholder)
  const initials = isPlaceholder
    ? "+"
    : data.user.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()

  const level = data.level ?? 0
  const palette = LEVEL_COLORS[Math.min(level, LEVEL_COLORS.length - 1)]
  const levelLabel = isPlaceholder ? "New hire" : data.isRoot ? "Top level" : `Level ${level + 1}`

  return (
    <div
      className="relative w-[min(220px,calc(100vw-3rem))] rounded-lg border-2 bg-card p-3 shadow-lg transition"
      style={{
        borderColor: palette.border,
        borderStyle: isPlaceholder ? "dashed" : "solid",
        boxShadow: `0 0 0 1px ${palette.glow}, 0 4px 12px rgba(0,0,0,0.25)`,
        opacity: isPlaceholder ? 0.92 : 1,
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-card"
        style={{ background: palette.border }}
      />

      <div className="mb-1.5 flex items-center justify-between">
        <span
          className="rounded-sm px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
          style={{ background: palette.glow, color: palette.border }}
        >
          {levelLabel}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => data.onRemove?.(id)}
          disabled={!data.onRemove}
          style={data.onRemove ? undefined : { visibility: "hidden" }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex items-center gap-2.5">
        <Avatar className="h-9 w-9 border border-border">
          <AvatarImage src={data.user.avatarUrl ?? undefined} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{data.user.name}</p>
          <div className="mt-0.5 flex items-center gap-1.5">
            {isPlaceholder ? (
              <Badge variant="secondary" className="max-w-28 truncate text-[10px]">
                {data.user.designation || "Open role"}
              </Badge>
            ) : data.showMemberRole === false ? (
              <Badge variant="outline" className="max-w-24 truncate text-[10px] capitalize">
                {data.user.role?.name?.replace("_", " ") ?? "User"}
              </Badge>
            ) : (
              <Badge variant="outline" className="max-w-24 truncate text-[10px] capitalize">
                {data.memberRole}
              </Badge>
            )}
            <span className={`h-2 w-2 rounded-full ${data.user.isActive ? "bg-green-500" : "bg-muted-foreground"}`} />
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-card"
        style={{ background: palette.border }}
      />
    </div>
  )
}

const nodeTypes: NodeTypes = {
  hierarchyNode: HierarchyNodeCard,
}

function HierarchyCanvasInner({
  kind,
  contextId,
  members,
  users,
  loading,
  allowRemove = true,
  onReload,
  adapter,
}: HierarchyCanvasProps) {
  const [nodes, setNodes] = useState<Node<HierarchyNodeData>[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [originalNodes, setOriginalNodes] = useState<Node<HierarchyNodeData>[]>([])
  const [originalEdges, setOriginalEdges] = useState<Edge[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [newHireOpen, setNewHireOpen] = useState(false)
  const [newHireSubmitting, setNewHireSubmitting] = useState(false)
  const [convertingPlaceholder, setConvertingPlaceholder] = useState(false)
  const [pendingNewHirePosition, setPendingNewHirePosition] = useState<{ x: number; y: number } | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [past, setPast] = useState<Snapshot[]>([])
  const [future, setFuture] = useState<Snapshot[]>([])

  const shellRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const flowRef = useRef<ReactFlowInstance<Node<HierarchyNodeData>, Edge> | null>(null)
  const hasInitialFitRef = useRef(false)
  const { syncGraph } = useHierarchySync({ contextId, adapter })
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const fitPadding = isFullscreen ? FULLSCREEN_FIT_PADDING : DEFAULT_FIT_PADDING
  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users])
  const enrichedMembers = useMemo<HierarchyMember[]>(() => {
    return members.map((member) => {
      const paletteUser = userById.get(member.userId)
      if (!paletteUser) return member
      return {
        ...member,
        user: {
          ...paletteUser,
          ...member.user,
          role: member.user?.role ?? paletteUser.role,
          avatarUrl: member.user?.avatarUrl ?? paletteUser.avatarUrl,
        },
      }
    })
  }, [members, userById])

  useEffect(() => {
    const initialEdges = buildEdgesFromMembers(enrichedMembers)
    const initialNodes = applyAutoLayout(buildNodesFromMembers(kind, contextId, enrichedMembers), initialEdges)
    setNodes(initialNodes)
    setEdges(initialEdges)
    setOriginalNodes(initialNodes)
    setOriginalEdges(initialEdges)
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setPast([])
    setFuture([])
    hasInitialFitRef.current = false
  }, [kind, contextId, enrichedMembers])

  useEffect(() => {
    if (hasInitialFitRef.current) return
    if (!flowRef.current || nodes.length === 0) return
    hasInitialFitRef.current = true
    setTimeout(() => {
      flowRef.current?.fitView({
        padding: DEFAULT_FIT_PADDING,
        duration: 0,
        minZoom: MIN_ZOOM,
        maxZoom: 0.72,
      })
    }, 80)
  }, [nodes, edges, kind, contextId])

  const pushSnapshot = useCallback(() => {
    setPast((prev) => [...prev.slice(-40), { nodes, edges }])
    setFuture([])
  }, [nodes, edges])

  const updateRole = useCallback(
    (nodeId: string, memberRole: MemberRole) => {
      pushSnapshot()
      setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, memberRole } } : node)))
    },
    [pushSnapshot]
  )

  const removeNode = useCallback(
    (nodeId: string) => {
      pushSnapshot()
      setNodes((prev) => prev.filter((node) => node.id !== nodeId))
      setEdges((prev) => prev.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
      if (selectedNodeId === nodeId) setSelectedNodeId(null)
    },
    [pushSnapshot, selectedNodeId]
  )

  const roots = useMemo(() => getRootNodeIds(nodes, edges), [nodes, edges])

  const levels = useMemo(() => {
    const map = new Map<string, number>()
    const adjacency = new Map<string, string[]>()
    edges.forEach((edge) => {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, [])
      adjacency.get(edge.source)!.push(edge.target)
    })

    const queue: { id: string; depth: number }[] = roots.map((id) => ({ id, depth: 0 }))
    const visited = new Set<string>()
    while (queue.length) {
      const { id, depth } = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)
      map.set(id, depth)
      const children = adjacency.get(id) ?? []
      children.forEach((child) => queue.push({ id: child, depth: depth + 1 }))
    }
    nodes.forEach((node) => {
      if (!map.has(node.id)) map.set(node.id, 0)
    })
    return map
  }, [nodes, edges, roots])

  const styledEdges = useMemo<Edge[]>(() => {
    return edges.map((edge) => {
      const sourceLevel = levels.get(edge.source) ?? 0
      const palette = LEVEL_COLORS[Math.min(sourceLevel, LEVEL_COLORS.length - 1)]
      const isSelected = edge.id === selectedEdgeId
      return {
        ...edge,
        type: "smoothstep",
        animated: isSelected,
        style: {
          stroke: palette.border,
          strokeWidth: isSelected ? 3 : 2,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: palette.border },
      }
    })
  }, [edges, levels, selectedEdgeId])

  const renderNodes = useMemo<Node<CanvasNodeData>[]>(() => {
    return nodes.map((node) => {
      const canRemove = allowRemove || Boolean(node.data.user.isPlaceholder)
      return {
        ...node,
        data: {
          ...node.data,
          isRoot: roots.includes(node.id),
          level: levels.get(node.id) ?? 0,
          onRemove: canRemove ? removeNode : undefined,
          showMemberRole: kind !== "user",
        },
      }
    })
  }, [nodes, roots, levels, removeNode, allowRemove, kind])

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<HierarchyNodeData>>[]) => {
      const significant = changes.some((c) => c.type !== "select" && c.type !== "dimensions")
      if (significant) pushSnapshot()
      setNodes((prev) => applyNodeChanges(changes, prev))
    },
    [pushSnapshot]
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      const significant = changes.some((c) => c.type !== "select")
      if (significant) pushSnapshot()
      setEdges((prev) => applyEdgeChanges(changes, prev))
    },
    [pushSnapshot]
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      const result = isConnectionValid(connection, edges)
      if (!result.valid) {
        toast.error(result.reason ?? "Invalid hierarchy connection")
        return
      }
      pushSnapshot()
      setEdges((prev) => addEdge(createHierarchyEdge(connection.source!, connection.target!), prev))
    },
    [edges, pushSnapshot]
  )

  const selectedNode = selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) ?? null : null
  const managerName = useMemo(() => {
    if (!selectedNode) return null
    const managerId = getManagerNodeId(selectedNode.id, edges)
    if (!managerId) return null
    return nodes.find((node) => node.id === managerId)?.data.user.name ?? null
  }, [selectedNode, edges, nodes])

  const managerUserId = useMemo(() => {
    if (!selectedNode) return null
    const managerId = getManagerNodeId(selectedNode.id, edges)
    if (!managerId) return null
    return nodes.find((node) => node.id === managerId)?.data.user.id ?? null
  }, [selectedNode, edges, nodes])

  const managerSelectOptions = useMemo(() => {
    const byId = new Map<string, User>()
    users.forEach((user) => {
      if (!user.isPlaceholder) byId.set(user.id, user)
    })
    nodes.forEach((node) => {
      if (!node.data.user.isPlaceholder) byId.set(node.data.user.id, node.data.user)
    })
    if (!selectedNode) return [...byId.values()]
    byId.delete(selectedNode.data.user.id)
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [selectedNode, users, nodes])

  const setManagerByUserId = useCallback(
    (managerUserId: string | null) => {
      if (!selectedNodeId || !selectedNode) return

      let nextNodes = nodes
      let managerNodeId: string | null = null

      if (managerUserId) {
        const existingManagerNode = nodes.find((node) => node.data.user.id === managerUserId)
        if (existingManagerNode) {
          managerNodeId = existingManagerNode.id
        } else {
          const managerUser = userById.get(managerUserId)
          if (!managerUser) {
            toast.error("Manager user not found")
            return
          }
          const newNode: Node<HierarchyNodeData> = {
            id: `temp-${managerUser.id}-${Date.now()}`,
            type: "hierarchyNode",
            position: {
              x: selectedNode.position.x,
              y: selectedNode.position.y - (NODE_HEIGHT + 40),
            },
            data: {
              user: managerUser,
              memberRole: "MEMBER",
              isActive: managerUser.isActive,
              contextId,
              kind,
            },
          }
          nextNodes = [...nodes, newNode]
          managerNodeId = newNode.id
        }
      }

      const withoutIncoming = edges.filter((edge) => edge.target !== selectedNodeId)
      if (!managerNodeId) {
        pushSnapshot()
        if (nextNodes !== nodes) setNodes(nextNodes)
        setEdges(withoutIncoming)
        return
      }

      const result = isConnectionValid(
        { source: managerNodeId, target: selectedNodeId, sourceHandle: null, targetHandle: null },
        withoutIncoming
      )
      if (!result.valid) {
        toast.error(result.reason ?? "Invalid manager")
        return
      }

      pushSnapshot()
      if (nextNodes !== nodes) setNodes(nextNodes)
      setEdges([...withoutIncoming, createHierarchyEdge(managerNodeId, selectedNodeId)])
    },
    [selectedNodeId, selectedNode, nodes, edges, userById, contextId, kind, pushSnapshot]
  )

  const setTopLevel = useCallback(() => {
    if (!selectedNodeId) return
    pushSnapshot()
    setEdges((prev) => prev.filter((edge) => edge.target !== selectedNodeId))
  }, [selectedNodeId, pushSnapshot])

  const saveHierarchy = useCallback(
    async (mode: "draft" | "publish") => {
      setSaving(true)
      try {
        const result = validateHierarchyGraph(nodes, edges, { maxDepth: 6 })
        if (result.errors.length > 0) {
          toast.error(result.errors[0])
          setSaving(false)
          return
        }
        if (result.warnings.length > 0) {
          toast.warning(result.warnings[0])
        }

        await syncGraph({ originalNodes, originalEdges, currentNodes: nodes, currentEdges: edges })
        await onReload()
        toast.success(mode === "draft" ? "Draft saved" : "Hierarchy published")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to sync hierarchy")
      } finally {
        setSaving(false)
      }
    },
    [nodes, edges, syncGraph, originalNodes, originalEdges, onReload]
  )

  const undo = useCallback(() => {
    setPast((prev) => {
      if (prev.length === 0) return prev
      const previous = prev[prev.length - 1]
      setFuture((futurePrev) => [{ nodes, edges }, ...futurePrev])
      setNodes(previous.nodes)
      setEdges(previous.edges)
      return prev.slice(0, -1)
    })
  }, [nodes, edges])

  const redo = useCallback(() => {
    setFuture((prev) => {
      if (prev.length === 0) return prev
      const next = prev[0]
      setPast((pastPrev) => [...pastPrev, { nodes, edges }])
      setNodes(next.nodes)
      setEdges(next.edges)
      return prev.slice(1)
    })
  }, [nodes, edges])

  const autoLayout = useCallback(() => {
    pushSnapshot()
    setNodes((prev) => applyAutoLayout(prev, edges))
    setTimeout(() => {
      flowRef.current?.fitView({
        duration: 300,
        padding: isFullscreen ? FULLSCREEN_FIT_PADDING : DEFAULT_FIT_PADDING,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
      })
    }, 50)
  }, [edges, pushSnapshot, isFullscreen])

  const exitFullscreen = useCallback(async () => {
    setIsFullscreen(false)
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen()
      } catch {
        /* already exited */
      }
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      void exitFullscreen()
      return
    }
    setIsFullscreen(true)
  }, [isFullscreen, exitFullscreen])

  // Enter native browser fullscreen so the whole monitor is used (hides browser chrome).
  useEffect(() => {
    if (!isFullscreen) return
    const original = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const el = shellRef.current
    const enter = async () => {
      if (!el || document.fullscreenElement) return
      try {
        await el.requestFullscreen()
      } catch {
        /* CSS fixed overlay still covers the viewport if the API is blocked */
      }
    }
    const enterTimer = window.setTimeout(() => {
      void enter()
    }, 30)

    const onFsChange = () => {
      if (!document.fullscreenElement) setIsFullscreen(false)
    }
    document.addEventListener("fullscreenchange", onFsChange)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) {
        e.preventDefault()
        setIsFullscreen(false)
      }
    }
    window.addEventListener("keydown", onKey)

    const refit = window.setTimeout(() => {
      flowRef.current?.fitView({
        padding: FULLSCREEN_FIT_PADDING,
        duration: 250,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
      })
    }, 120)

    return () => {
      document.body.style.overflow = original
      document.removeEventListener("fullscreenchange", onFsChange)
      window.removeEventListener("keydown", onKey)
      window.clearTimeout(enterTimer)
      window.clearTimeout(refit)
    }
  }, [isFullscreen])

  // Refit when the canvas container resizes (fullscreen toggle, window resize).
  useEffect(() => {
    const el = wrapperRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    let timer: number | undefined
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        flowRef.current?.fitView({
          padding: isFullscreen ? FULLSCREEN_FIT_PADDING : DEFAULT_FIT_PADDING,
          duration: 200,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
        })
      }, 80)
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [isFullscreen])

  const exportPng = useCallback(async () => {
    if (!wrapperRef.current) return
    try {
      const cardBg = getComputedStyle(document.documentElement).getPropertyValue("--card").trim() || "#1a110e"
      const dataUrl = await toPng(wrapperRef.current, { cacheBust: true, backgroundColor: cardBg })
      const link = document.createElement("a")
      link.download = `${kind}-hierarchy-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } catch {
      toast.error("Failed to export PNG")
    }
  }, [kind])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey
      if (isMeta && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault()
        undo()
      }
      if (isMeta && event.key.toLowerCase() === "z" && event.shiftKey) {
        event.preventDefault()
        redo()
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedNodeId) {
          const selected = nodes.find((node) => node.id === selectedNodeId)
          const canRemove = allowRemove || Boolean(selected?.data.user.isPlaceholder)
          if (!canRemove) return
          event.preventDefault()
          removeNode(selectedNodeId)
        } else if (selectedEdgeId) {
          event.preventDefault()
          pushSnapshot()
          setEdges((prev) => prev.filter((edge) => edge.id !== selectedEdgeId))
          setSelectedEdgeId(null)
        }
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [undo, redo, selectedNodeId, selectedEdgeId, removeNode, pushSnapshot, nodes, allowRemove])

  const openNewHireDialog = useCallback((position?: { x: number; y: number } | null) => {
    if (position) {
      setPendingNewHirePosition(position)
    } else if (flowRef.current) {
      const bounds = wrapperRef.current?.getBoundingClientRect()
      const screenPoint = bounds
        ? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 }
      setPendingNewHirePosition(flowRef.current.screenToFlowPosition(screenPoint))
    } else {
      setPendingNewHirePosition({ x: 120, y: 120 })
    }
    setNewHireOpen(true)
  }, [])

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      if (!flowRef.current) return

      const position = flowRef.current.screenToFlowPosition({ x: event.clientX, y: event.clientY })

      if (kind === "user" && event.dataTransfer.getData(NEW_HIRE_DRAG_MIME)) {
        openNewHireDialog(position)
        return
      }

      const raw = event.dataTransfer.getData("application/bran-user")
      if (!raw) return

      const user = JSON.parse(raw) as User
      const exists = nodes.some((node) => node.data.user.id === user.id)
      if (exists) {
        toast.error("User is already on the canvas")
        return
      }

      const newNode: Node<HierarchyNodeData> = {
        id: `temp-${user.id}-${Date.now()}`,
        type: "hierarchyNode",
        position,
        data: {
          user,
          memberRole: "MEMBER",
          isActive: user.isActive,
          contextId,
          kind,
        },
      }

      pushSnapshot()
      setNodes((prev) => [...prev, newNode])
    },
    [nodes, contextId, kind, pushSnapshot, openNewHireDialog]
  )

  const handleCreateNewHire = useCallback(
    async (values: NewHireFormValues) => {
      const position = pendingNewHirePosition ?? { x: 120, y: 120 }
      setNewHireSubmitting(true)
      try {
        const user = await usersApi.createNewHire({
          name: values.name,
          designation: values.designation || undefined,
          roleId: values.roleId,
          email: values.email || undefined,
        })

        const newNode: Node<HierarchyNodeData> = {
          id: user.id,
          type: "hierarchyNode",
          position,
          data: {
            memberId: user.id,
            user: { ...user, isPlaceholder: true },
            memberRole: "MEMBER",
            isActive: user.isActive,
            contextId,
            kind,
          },
        }

        pushSnapshot()
        setNodes((prev) => [...prev, newNode])
        setOriginalNodes((prev) => [...prev, newNode])
        setSelectedNodeId(user.id)
        setNewHireOpen(false)
        setPendingNewHirePosition(null)
        toast.success("New hire box added — connect a manager, then publish")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to create new hire")
      } finally {
        setNewHireSubmitting(false)
      }
    },
    [pendingNewHirePosition, pushSnapshot, contextId, kind]
  )

  const handleConvertPlaceholder = useCallback(
    async (values: { name: string; email: string; designation: string }) => {
      if (!selectedNode || !selectedNode.data.user.isPlaceholder) return
      setConvertingPlaceholder(true)
      try {
        const updated = await usersApi.update(selectedNode.data.user.id, {
          name: values.name,
          email: values.email,
          designation: values.designation || undefined,
          isPlaceholder: false,
          isActive: true,
          managerUserId: managerUserId,
        })
        setNodes((prev) =>
          prev.map((node) =>
            node.id === selectedNode.id
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    user: { ...updated, isPlaceholder: false },
                    isActive: updated.isActive,
                  },
                }
              : node
          )
        )
        toast.success("Converted to a real user")
        await onReload()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to convert placeholder")
      } finally {
        setConvertingPlaceholder(false)
      }
    },
    [selectedNode, managerUserId, onReload]
  )

  const canvasUsers = useMemo(
    () => nodes.map((node) => ({ nodeId: node.id, user: node.data.user })),
    [nodes]
  )

  const selectAndFocusNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId)
    setSelectedEdgeId(null)
    setNodes((prev) => prev.map((node) => ({ ...node, selected: node.id === nodeId })))

    // Wait a tick so selection paints, then zoom the map onto that person.
    window.setTimeout(() => {
      const node = flowRef.current?.getNode(nodeId)
      if (!flowRef.current || !node) return
      flowRef.current.setCenter(
        node.position.x + NODE_WIDTH / 2,
        node.position.y + NODE_HEIGHT / 2,
        { zoom: Math.max(flowRef.current.getZoom(), 1.05), duration: 420 }
      )
    }, 30)
  }, [])

  if (loading) return <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">Loading hierarchy...</div>

  const canvas = (
    <div
      ref={shellRef}
      className={
        isFullscreen
          ? "fixed inset-0 z-[100] flex h-screen w-screen flex-col overflow-hidden bg-background"
          : "space-y-3"
      }
    >
      {/* Compact toolbar */}
      <div
        className={
          isFullscreen
            ? "flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2"
            : "flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2.5"
        }
      >
        <Button size="sm" variant="outline" className="gap-1.5" disabled={past.length === 0} onClick={undo}>
          <Undo2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Undo</span>
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={future.length === 0} onClick={redo}>
          <Redo2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Redo</span>
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={autoLayout}>
          <Sparkles className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Auto layout</span>
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={exportPng}>
          <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Export PNG</span>
        </Button>
        {kind === "user" && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openNewHireDialog()}>
            <UserPlus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">New Hire</span>
          </Button>
        )}
        <Button size="sm" variant="outline" className="gap-1.5" onClick={toggleFullscreen}>
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{isFullscreen ? "Exit fullscreen" : "Fullscreen"}</span>
        </Button>

        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <Button size="sm" variant="outline" className="gap-1.5" disabled={saving} onClick={() => saveHierarchy("draft")}>
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save Draft"}
          </Button>
          <Button size="sm" className="gap-1.5" disabled={saving} onClick={() => saveHierarchy("publish")}>
            <Upload className="h-3.5 w-3.5" /> {saving ? "Publishing..." : "Publish"}
          </Button>
        </div>
      </div>

      <div
        className={
          isFullscreen
            ? "relative min-h-0 flex-1"
            : "grid h-[50vh] min-h-[280px] gap-3 sm:h-[60vh] lg:h-[74vh] lg:grid-cols-[260px_minmax(0,1fr)_280px]"
        }
      >
        <div
          className={
            isFullscreen
              ? "absolute bottom-3 left-3 top-3 z-20 hidden min-h-0 w-[280px] lg:flex"
              : "hidden min-h-0 lg:flex"
          }
        >
          <UserPalette
            canvasUsers={canvasUsers}
            users={users}
            allowNewHire={kind === "user"}
            selectedNodeId={selectedNodeId}
            onSelectNode={selectAndFocusNode}
            onAddNewHire={() => openNewHireDialog()}
          />
        </div>

        <div
          className={
            isFullscreen
              ? "absolute inset-0 overflow-hidden bg-background"
              : "relative min-h-0 overflow-hidden rounded-lg border border-border"
          }
          ref={wrapperRef}
        >
          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm font-medium text-accent">
                {kind === "user" ? "Drag people or a New Hire box from the palette" : "Drag team members from the palette"}
              </p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Drop them here, then drag from the bottom dot of a manager to the top dot of their report to draw a reporting line.
              </p>
            </div>
          )}
          <ReactFlow
            nodes={renderNodes}
            edges={styledEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={(instance) => {
              flowRef.current = instance
            }}
            onDrop={onDrop}
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = "copy"
            }}
            onSelectionChange={({ nodes: selectedNodes, edges: selectedEdges }) => {
              setSelectedNodeId(selectedNodes[0]?.id ?? null)
              setSelectedEdgeId(selectedEdges[0]?.id ?? null)
            }}
            fitView
            fitViewOptions={{ padding: fitPadding, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM }}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            connectionRadius={40}
            connectionLineStyle={{ stroke: "#d4af37", strokeWidth: 2 }}
            defaultEdgeOptions={{
              type: "smoothstep",
              style: { stroke: "#8b703e", strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#8b703e" },
              animated: false,
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Controls
              showFitView
              className="!border-border !bg-card !shadow-md [&>button]:!border-border [&>button]:!bg-card [&>button]:!text-foreground [&>button:hover]:!bg-muted"
            >
              <ControlButton
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit fullscreen" : "Open fullscreen"}
                aria-label={isFullscreen ? "Exit fullscreen" : "Open fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </ControlButton>
            </Controls>
            <Background color="rgba(139, 112, 62, 0.08)" gap={24} />
          </ReactFlow>
        </div>

        <div
          className={
            isFullscreen
              ? "absolute bottom-3 right-3 top-3 z-20 hidden min-h-0 w-[280px] lg:flex"
              : "hidden min-h-0 lg:flex"
          }
        >
          <NodeInspector
            node={selectedNode}
            managerName={managerName}
            managerUserId={managerUserId}
            managerOptions={managerSelectOptions}
            kind={kind}
            allowRemove={allowRemove || Boolean(selectedNode?.data.user.isPlaceholder)}
            converting={convertingPlaceholder}
            onRoleChange={(memberRole) => selectedNodeId && updateRole(selectedNodeId, memberRole)}
            onManagerChange={setManagerByUserId}
            onSetTopLevel={setTopLevel}
            onRemove={() => selectedNodeId && removeNode(selectedNodeId)}
            onConvertPlaceholder={kind === "user" ? handleConvertPlaceholder : undefined}
          />
        </div>
      </div>

      <NewHireDialog
        open={newHireOpen}
        submitting={newHireSubmitting}
        onOpenChange={(open) => {
          setNewHireOpen(open)
          if (!open) setPendingNewHirePosition(null)
        }}
        onSubmit={handleCreateNewHire}
      />

      <Dialog
        open={!!selectedNode && !isDesktop}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedNodeId(null)
            setSelectedEdgeId(null)
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Node Inspector</DialogTitle>
          </DialogHeader>
          <NodeInspector
            node={selectedNode}
            managerName={managerName}
            managerUserId={managerUserId}
            managerOptions={managerSelectOptions}
            kind={kind}
            allowRemove={allowRemove || Boolean(selectedNode?.data.user.isPlaceholder)}
            converting={convertingPlaceholder}
            onRoleChange={(memberRole) => selectedNodeId && updateRole(selectedNodeId, memberRole)}
            onManagerChange={setManagerByUserId}
            onSetTopLevel={setTopLevel}
            onRemove={() => selectedNodeId && removeNode(selectedNodeId)}
            onConvertPlaceholder={kind === "user" ? handleConvertPlaceholder : undefined}
          />
        </DialogContent>
      </Dialog>
    </div>
  )

  // Portal out of the blurred/overflow layout shell so fullscreen covers the real viewport.
  return isFullscreen ? createPortal(canvas, document.body) : canvas
}

export function HierarchyCanvas(props: HierarchyCanvasProps) {
  return (
    <ReactFlowProvider>
      <HierarchyCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
