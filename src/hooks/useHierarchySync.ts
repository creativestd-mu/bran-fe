import { useCallback } from "react"
import type { Edge, Node } from "@xyflow/react"
import type { HierarchyMemberPayload } from "@/types"
import type { HierarchyNodeData } from "@/components/hierarchy/hierarchyUtils"
import { diffHierarchyGraphs, toHierarchyPayloads } from "@/components/hierarchy/hierarchyUtils"

interface HierarchySyncAdapter {
  addMember: (contextId: string, data: HierarchyMemberPayload) => Promise<unknown>
  updateMember: (memberId: string, data: Partial<HierarchyMemberPayload>) => Promise<unknown>
  deleteMember: (memberId: string) => Promise<unknown>
  upsertGraph?: (
    contextId: string,
    data: {
      members: Array<{
        userId: string
        memberRole: HierarchyMemberPayload["memberRole"]
        reportsToUserId: string | null
      }>
    }
  ) => Promise<unknown>
}

interface UseHierarchySyncOptions {
  contextId: string
  adapter: HierarchySyncAdapter
}

export function useHierarchySync({ contextId, adapter }: UseHierarchySyncOptions) {
  const syncGraph = useCallback(
    async (params: {
      originalNodes: Node<HierarchyNodeData>[]
      originalEdges: Edge[]
      currentNodes: Node<HierarchyNodeData>[]
      currentEdges: Edge[]
    }) => {
      const { originalNodes, originalEdges, currentNodes, currentEdges } = params

      if (adapter.upsertGraph) {
        const members = toHierarchyPayloads(currentNodes, currentEdges).map((node) => ({
          userId: node.userId,
          memberRole: node.memberRole,
          reportsToUserId: node.reportsToUserId,
        }))
        await adapter.upsertGraph(contextId, { members })
        return { created: [], updated: [], deletedMemberIds: [] }
      }

      const diff = diffHierarchyGraphs(originalNodes, originalEdges, currentNodes, currentEdges)

      for (const node of diff.created) {
        await adapter.addMember(contextId, {
          userId: node.userId,
          memberRole: node.memberRole,
          reportsToUserId: node.reportsToUserId,
          isActive: node.isActive,
        })
      }

      for (const node of diff.updated) {
        if (!node.memberId) continue
        await adapter.updateMember(node.memberId, {
          memberRole: node.memberRole,
          reportsToUserId: node.reportsToUserId,
          isActive: node.isActive,
        })
      }

      for (const memberId of diff.deletedMemberIds) {
        await adapter.deleteMember(memberId)
      }

      return diff
    },
    [adapter, contextId]
  )

  const removeMemberNode = useCallback(
    async (node: Node<HierarchyNodeData>) => {
      if (!node.data.memberId) return
      await adapter.deleteMember(node.data.memberId)
    },
    [adapter]
  )

  return {
    syncGraph,
    removeMemberNode,
  }
}
