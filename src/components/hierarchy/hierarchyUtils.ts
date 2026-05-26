import dagre from "dagre"
import type { Connection, Edge, Node } from "@xyflow/react"
import { MarkerType } from "@xyflow/react"
import type { HierarchyKind, HierarchyMember, MemberRole, User } from "@/types"

export const NODE_WIDTH = 260
export const NODE_HEIGHT = 132
export const DEFAULT_MEMBER_ROLE: MemberRole = "MEMBER"

export interface HierarchyNodeData {
  memberId?: string
  user: User
  memberRole: MemberRole
  isActive: boolean
  contextId: string
  kind: HierarchyKind
}

export interface HierarchyValidationResult {
  errors: string[]
  warnings: string[]
}

export interface HierarchyNodePayload {
  nodeId: string
  memberId?: string
  userId: string
  memberRole: MemberRole
  isActive: boolean
  reportsToUserId: string | null
}

export interface HierarchyGraphDiff {
  created: HierarchyNodePayload[]
  updated: HierarchyNodePayload[]
  deletedMemberIds: string[]
}

const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))

export function buildNodesFromMembers(kind: HierarchyKind, contextId: string, members: HierarchyMember[]): Node<HierarchyNodeData>[] {
  return members.map((member, index) => ({
    id: member.id,
    type: "hierarchyNode",
    position: {
      x: (index % 3) * (NODE_WIDTH + 30),
      y: Math.floor(index / 3) * (NODE_HEIGHT + 30),
    },
    data: {
      memberId: member.id,
      user: member.user,
      memberRole: member.memberRole,
      isActive: member.isActive ?? member.user.isActive,
      contextId,
      kind,
    },
  }))
}

export function buildEdgesFromMembers(members: HierarchyMember[]): Edge[] {
  const byUserId = new Map<string, string>()
  members.forEach((member) => byUserId.set(member.userId, member.id))

  return members
    .filter((member) => member.reportsToUserId && byUserId.has(member.reportsToUserId))
    .map((member) => {
      const sourceId = byUserId.get(member.reportsToUserId!)!
      return createHierarchyEdge(sourceId, member.id)
    })
}

export function createHierarchyEdge(source: string, target: string): Edge {
  return {
    id: `edge-${source}-${target}`,
    source,
    target,
    type: "smoothstep",
    style: { stroke: "#8b703e", strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#8b703e" },
  }
}

export function applyAutoLayout(nodes: Node<HierarchyNodeData>[], edges: Edge[]): Node<HierarchyNodeData>[] {
  graph.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 120, marginx: 40, marginy: 40 })

  nodes.forEach((node) => graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }))
  edges.forEach((edge) => graph.setEdge(edge.source, edge.target))

  dagre.layout(graph)

  return nodes.map((node) => {
    const pos = graph.node(node.id)
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    }
  })
}

function detectCycleWithNewEdge(source: string, target: string, edges: Edge[]): boolean {
  const adjacency = new Map<string, string[]>()
  edges.forEach((edge) => {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, [])
    adjacency.get(edge.source)!.push(edge.target)
  })

  if (!adjacency.has(source)) adjacency.set(source, [])
  adjacency.get(source)!.push(target)

  const visited = new Set<string>()
  const stack = new Set<string>()

  const dfs = (nodeId: string): boolean => {
    if (stack.has(nodeId)) return true
    if (visited.has(nodeId)) return false

    visited.add(nodeId)
    stack.add(nodeId)
    const neighbors = adjacency.get(nodeId) ?? []
    for (const next of neighbors) {
      if (dfs(next)) return true
    }
    stack.delete(nodeId)
    return false
  }

  for (const nodeId of adjacency.keys()) {
    if (dfs(nodeId)) return true
  }
  return false
}

export function isConnectionValid(
  connection: Connection,
  edges: Edge[],
  options?: { maxManagersPerNode?: number }
): { valid: boolean; reason?: string } {
  const { source, target } = connection
  if (!source || !target) return { valid: false, reason: "Invalid connection." }
  if (source === target) return { valid: false, reason: "A user cannot report to themselves." }

  const maxManagersPerNode = options?.maxManagersPerNode ?? 1
  const incomingCount = edges.filter((edge) => edge.target === target && edge.source !== source).length
  if (incomingCount >= maxManagersPerNode) {
    return { valid: false, reason: "This user already has a manager." }
  }

  const duplicate = edges.some((edge) => edge.source === source && edge.target === target)
  if (duplicate) return { valid: false, reason: "Connection already exists." }

  if (detectCycleWithNewEdge(source, target, edges)) {
    return { valid: false, reason: "This connection creates a cycle." }
  }

  return { valid: true }
}

export function getRootNodeIds(nodes: Node<HierarchyNodeData>[], edges: Edge[]): string[] {
  const incoming = new Set(edges.map((edge) => edge.target))
  return nodes.filter((node) => !incoming.has(node.id)).map((node) => node.id)
}

export function getManagerNodeId(nodeId: string, edges: Edge[]): string | null {
  return edges.find((edge) => edge.target === nodeId)?.source ?? null
}

export function toHierarchyPayloads(nodes: Node<HierarchyNodeData>[], edges: Edge[]): HierarchyNodePayload[] {
  return nodes.map((node) => {
    const managerNodeId = getManagerNodeId(node.id, edges)
    const managerUserId = managerNodeId ? nodes.find((n) => n.id === managerNodeId)?.data.user.id ?? null : null

    return {
      nodeId: node.id,
      memberId: node.data.memberId,
      userId: node.data.user.id,
      memberRole: node.data.memberRole,
      isActive: node.data.isActive,
      reportsToUserId: managerUserId,
    }
  })
}

export function diffHierarchyGraphs(
  originalNodes: Node<HierarchyNodeData>[],
  originalEdges: Edge[],
  currentNodes: Node<HierarchyNodeData>[],
  currentEdges: Edge[]
): HierarchyGraphDiff {
  const originalPayloads = toHierarchyPayloads(originalNodes, originalEdges)
  const currentPayloads = toHierarchyPayloads(currentNodes, currentEdges)

  const originalByMemberId = new Map(originalPayloads.filter((p) => p.memberId).map((p) => [p.memberId!, p]))
  const currentMemberIds = new Set(currentPayloads.map((p) => p.memberId).filter(Boolean))

  const created = currentPayloads.filter((payload) => !payload.memberId)
  const updated = currentPayloads.filter((payload) => {
    if (!payload.memberId) return false
    const prev = originalByMemberId.get(payload.memberId)
    if (!prev) return false
    return (
      prev.memberRole !== payload.memberRole ||
      prev.isActive !== payload.isActive ||
      prev.reportsToUserId !== payload.reportsToUserId
    )
  })

  const deletedMemberIds = [...originalByMemberId.keys()].filter((memberId) => !currentMemberIds.has(memberId))
  return { created, updated, deletedMemberIds }
}

export function validateHierarchyGraph(
  nodes: Node<HierarchyNodeData>[],
  edges: Edge[],
  options?: { maxDepth?: number }
): HierarchyValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  for (const edge of edges) {
    const result = isConnectionValid({ source: edge.source, target: edge.target }, edges.filter((e) => e.id !== edge.id))
    if (!result.valid) errors.push(result.reason ?? "Invalid edge found.")
  }

  const contextIds = new Set(nodes.map((node) => node.data.contextId))
  if (contextIds.size > 1) errors.push("All nodes must belong to the same context.")

  const roots = getRootNodeIds(nodes, edges)
  if (roots.length > 1) warnings.push("Hierarchy has multiple disconnected top-level leaders.")
  if (roots.length === nodes.length && nodes.length > 1) warnings.push("No reporting edges yet; hierarchy is disconnected.")

  if (options?.maxDepth && options.maxDepth > 0) {
    const adjacency = new Map<string, string[]>()
    edges.forEach((edge) => {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, [])
      adjacency.get(edge.source)!.push(edge.target)
    })

    const depthOf = (nodeId: string, depth: number, visited: Set<string>): number => {
      if (visited.has(nodeId)) return depth
      visited.add(nodeId)
      const children = adjacency.get(nodeId) ?? []
      if (children.length === 0) return depth
      return Math.max(...children.map((child) => depthOf(child, depth + 1, new Set(visited))))
    }

    const maxDepth = roots.length ? Math.max(...roots.map((root) => depthOf(root, 1, new Set()))) : 0
    if (maxDepth > options.maxDepth) warnings.push(`Hierarchy depth (${maxDepth}) exceeds recommended max (${options.maxDepth}).`)
  }

  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] }
}
