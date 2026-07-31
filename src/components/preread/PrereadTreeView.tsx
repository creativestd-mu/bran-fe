import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { PrereadNodeKind, PrereadTreeNode } from "@/types"
import { cn } from "@/lib/utils"
import "./preread.css"

const KIND_LABELS: Record<PrereadNodeKind, string> = {
  output: "Output",
  blocker: "Blocker",
  advice: "Advice",
}

interface PrereadTreeViewProps {
  tree: PrereadTreeNode[]
  selectedNodeId: string | null
  onSelectNode: (node: PrereadTreeNode) => void
}

function TreeNode({
  node,
  selectedNodeId,
  onSelectNode,
}: {
  node: PrereadTreeNode
  selectedNodeId: string | null
  onSelectNode: (node: PrereadTreeNode) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0

  return (
    <li>
      <div className="flex items-start gap-1">
        {hasChildren ? (
          <button
            type="button"
            className="mt-2 shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded((v) => !v)
            }}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="mt-2 inline-block w-5 shrink-0" />
        )}
        <button
          type="button"
          className={cn(
            "preread-node-card kind-" + node.kind,
            selectedNodeId === node.id && "selected"
          )}
          onClick={() => onSelectNode(node)}
        >
          <span className={cn("preread-kind-badge", "kind-" + node.kind)}>
            {KIND_LABELS[node.kind]}
          </span>
          <span className="truncate text-sm font-medium">{node.title}</span>
        </button>
      </div>
      {hasChildren && expanded && (
        <ul>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function PrereadTreeView({ tree, selectedNodeId, onSelectNode }: PrereadTreeViewProps) {
  const sortedTree = useMemo(
    () =>
      [...tree].sort(
        (a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt)
      ),
    [tree]
  )

  if (sortedTree.length === 0) {
    return (
      <div className="preread-tree-shell flex items-center justify-center text-sm text-muted-foreground">
        No nodes yet. Add a root node to start the tree.
      </div>
    )
  }

  return (
    <div className="preread-tree-shell">
      <ul className="preread-tree">
        {sortedTree.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
          />
        ))}
      </ul>
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
