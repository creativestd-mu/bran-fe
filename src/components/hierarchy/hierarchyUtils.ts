import type { Connection, Edge, Node } from "@xyflow/react"
import { MarkerType } from "@xyflow/react"
import type { HierarchyKind, HierarchyMember, MemberRole, User, UserHierarchyMember } from "@/types"

export const NODE_WIDTH = 260
export const NODE_HEIGHT = 132
export const DEFAULT_MEMBER_ROLE: MemberRole = "MEMBER"

export interface HierarchyNodeData extends Record<string, unknown> {
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

/** Horizontal gap between sibling subtrees (keeps branches visually distinct). */
const BRANCH_GAP_X = 72
/** Vertical gap between hierarchy levels. */
const BRANCH_GAP_Y = 110
/** Extra gap between separate top-level trees in a forest. */
const TREE_GAP_X = 120

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

/**
 * Org-chart tree layout: each parent is centered above its children, and sibling
 * subtrees are spaced apart so the graph reads as branched rather than one flat row.
 */
export function applyAutoLayout(nodes: Node<HierarchyNodeData>[], edges: Edge[]): Node<HierarchyNodeData>[] {
  if (nodes.length === 0) return nodes

  const nodeIds = new Set(nodes.map((node) => node.id))
  const children = new Map<string, string[]>()
  const parentOf = new Map<string, string>()

  edges.forEach((edge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return
    // One manager per report — keep the first edge if duplicates sneak in.
    if (parentOf.has(edge.target)) return
    parentOf.set(edge.target, edge.source)
    if (!children.has(edge.source)) children.set(edge.source, [])
    children.get(edge.source)!.push(edge.target)
  })

  // Stable sibling order by existing x, then name.
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  for (const [, kids] of children) {
    kids.sort((a, b) => {
      const na = nodeById.get(a)!
      const nb = nodeById.get(b)!
      if (na.position.x !== nb.position.x) return na.position.x - nb.position.x
      return na.data.user.name.localeCompare(nb.data.user.name)
    })
  }

  const roots = nodes
    .filter((node) => !parentOf.has(node.id))
    .sort((a, b) => {
      if (a.position.x !== b.position.x) return a.position.x - b.position.x
      return a.data.user.name.localeCompare(b.data.user.name)
    })
    .map((node) => node.id)

  const positions = new Map<string, { x: number; y: number }>()

  const measureSubtreeWidth = (id: string): number => {
    const kids = children.get(id) ?? []
    if (kids.length === 0) return NODE_WIDTH
    const kidsWidth =
      kids.reduce((sum, kid) => sum + measureSubtreeWidth(kid), 0) + BRANCH_GAP_X * (kids.length - 1)
    return Math.max(NODE_WIDTH, kidsWidth)
  }

  const place = (id: string, left: number, depth: number): number => {
    const kids = children.get(id) ?? []
    const y = depth * (NODE_HEIGHT + BRANCH_GAP_Y)

    if (kids.length === 0) {
      positions.set(id, { x: left, y })
      return left + NODE_WIDTH / 2
    }

    let cursor = left
    const childCenters: number[] = []
    for (const kid of kids) {
      const width = measureSubtreeWidth(kid)
      const center = place(kid, cursor, depth + 1)
      childCenters.push(center)
      cursor += width + BRANCH_GAP_X
    }

    const centerX = (childCenters[0] + childCenters[childCenters.length - 1]) / 2
    positions.set(id, { x: centerX - NODE_WIDTH / 2, y })
    return centerX
  }

  let forestLeft = 40
  for (const rootId of roots) {
    const width = measureSubtreeWidth(rootId)
    place(rootId, forestLeft, 0)
    forestLeft += width + TREE_GAP_X
  }

  // Fallback for any node missed (shouldn't happen, but keep layout complete).
  nodes.forEach((node, index) => {
    if (!positions.has(node.id)) {
      positions.set(node.id, {
        x: 40 + (index % 4) * (NODE_WIDTH + BRANCH_GAP_X),
        y: 40 + Math.floor(index / 4) * (NODE_HEIGHT + BRANCH_GAP_Y),
      })
    }
  })

  return nodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? node.position,
  }))
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
    const result = isConnectionValid(
      { source: edge.source, target: edge.target, sourceHandle: null, targetHandle: null },
      edges.filter((e) => e.id !== edge.id)
    )
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

function userHierarchyMemberToUser(member: UserHierarchyMember, paletteUser?: User): User {
  if (paletteUser) {
    return {
      ...paletteUser,
      isPlaceholder: member.isPlaceholder ?? paletteUser.isPlaceholder,
      designation: member.designation ?? paletteUser.designation,
      managerUserId: member.managerUserId,
      isActive: member.isActive,
      name: member.name || paletteUser.name,
      email: member.email || paletteUser.email,
      role: member.role ?? paletteUser.role,
      roleId: member.role?.id ?? paletteUser.roleId,
    }
  }
  return {
    id: member.id,
    googleId: "",
    email: member.email,
    name: member.name,
    avatarUrl: null,
    description: null,
    phone: null,
    designation: member.designation,
    roleId: member.role.id,
    isActive: member.isActive,
    isPlaceholder: member.isPlaceholder,
    managerUserId: member.managerUserId,
    lastLoginAt: null,
    createdAt: "",
    updatedAt: "",
    role: member.role,
    manager: member.manager,
  }
}

/** Merge directory users with hierarchy members so placeholders always appear in the palette. */
export function mergeHierarchyPaletteUsers(
  directoryUsers: User[],
  hierarchyMembers: UserHierarchyMember[]
): User[] {
  const byId = new Map(directoryUsers.map((user) => [user.id, user]))
  for (const member of hierarchyMembers) {
    const existing = byId.get(member.id)
    byId.set(member.id, userHierarchyMemberToUser(member, existing))
  }
  return [...byId.values()].sort((a, b) => {
    if (Boolean(a.isPlaceholder) !== Boolean(b.isPlaceholder)) return a.isPlaceholder ? 1 : -1
    return a.name.localeCompare(b.name)
  })
}

export function usersToHierarchyMembers(
  members: UserHierarchyMember[],
  paletteUsers: User[] = []
): HierarchyMember[] {
  const paletteById = new Map(paletteUsers.map((user) => [user.id, user]))
  return members.map((member) => ({
    id: member.id,
    userId: member.id,
    memberRole: DEFAULT_MEMBER_ROLE,
    isActive: member.isActive,
    reportsToUserId: member.managerUserId,
    user: userHierarchyMemberToUser(member, paletteById.get(member.id)),
  }))
}

export function toUserHierarchyPayloads(nodes: Node<HierarchyNodeData>[], edges: Edge[]) {
  return toHierarchyPayloads(nodes, edges).map((node) => ({
    userId: node.userId,
    managerUserId: node.reportsToUserId,
  }))
}
