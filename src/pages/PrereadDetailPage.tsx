import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Copy,
  Loader2,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react"
import { toast } from "sonner"
import { prereadApi, usersApi, ApiError } from "@/lib/api"
import type { PrereadNodeKind, PrereadTreeNode } from "@/types"
import { ManageAccessDialog } from "@/components/preread/ManageAccessDialog"
import { PrereadNodeModal } from "@/components/preread/PrereadNodeModal"
import { findTreeNode, PrereadTreeView } from "@/components/preread/PrereadTreeView"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

const KIND_OPTIONS: { value: PrereadNodeKind; label: string }[] = [
  { value: "output", label: "Output" },
  { value: "blocker", label: "Blocker" },
  { value: "advice", label: "Advice" },
]

function flattenNodes(tree: PrereadTreeNode[]): PrereadTreeNode[] {
  const out: PrereadTreeNode[] = []
  const walk = (nodes: PrereadTreeNode[]) => {
    for (const node of nodes) {
      out.push(node)
      walk(node.children)
    }
  }
  walk(tree)
  return out
}

export default function PrereadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [accessOpen, setAccessOpen] = useState(false)
  const [addNodeOpen, setAddNodeOpen] = useState(false)
  const [nodeTitle, setNodeTitle] = useState("")
  const [nodeKind, setNodeKind] = useState<PrereadNodeKind>("output")
  const [nodeParentId, setNodeParentId] = useState<string>("root")

  const { data, isLoading, error } = useQuery({
    queryKey: ["preread", id],
    queryFn: () => prereadApi.get(id!),
    enabled: Boolean(id),
    retry: (count, err) => {
      if (err instanceof ApiError && (err.status === 403 || err.status === 404)) return false
      return count < 2
    },
  })

  const { data: users = [] } = useQuery({
    queryKey: ["users", "preread-access"],
    queryFn: () => usersApi.listAll({ isActive: true }),
  })

  useEffect(() => {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
      toast.error(error.status === 403 ? "You do not have access to this preread" : "Preread not found")
      navigate("/preread", { replace: true })
    }
  }, [error, navigate])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["preread", id] })
    queryClient.invalidateQueries({ queryKey: ["prereads"] })
  }

  const membersMutation = useMutation({
    mutationFn: (userIds: string[]) => prereadApi.replaceMembers(id!, userIds),
    onSuccess: () => {
      invalidate()
      setAccessOpen(false)
      toast.success("Access updated")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const createNodeMutation = useMutation({
    mutationFn: () =>
      prereadApi.createNode(id!, {
        title: nodeTitle.trim(),
        kind: nodeKind,
        parentId: nodeParentId === "root" ? null : nodeParentId,
      }),
    onSuccess: () => {
      invalidate()
      setAddNodeOpen(false)
      setNodeTitle("")
      setNodeKind("output")
      setNodeParentId("root")
      toast.success("Node added")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteNodeMutation = useMutation({
    mutationFn: (nodeId: string) => prereadApi.deleteNode(id!, nodeId),
    onSuccess: () => {
      if (selectedNodeId) {
        setSelectedNodeId(null)
        setModalOpen(false)
      }
      invalidate()
      toast.success("Node deleted")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const flatNodes = useMemo(() => flattenNodes(data?.tree ?? []), [data?.tree])
  const selectedNode = useMemo(() => {
    if (!data || !selectedNodeId) return null
    return findTreeNode(data.tree, selectedNodeId)
  }, [data, selectedNodeId])

  const copyShareLink = () => {
    if (!id) return
    navigator.clipboard.writeText(`${window.location.origin}/preread/${id}`).then(
      () => toast.success("Share link copied"),
      () => toast.error("Could not copy link")
    )
  }

  if (!id) return null

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
            <Link to="/preread">
              <ArrowLeft className="mr-2 h-4 w-4" />
              All prereads
            </Link>
          </Button>
          <div>
            <h1 className="font-brand text-2xl tracking-wide">{data.title}</h1>
            {data.description && (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{data.description}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copyShareLink}>
            <Copy className="mr-2 h-4 w-4" />
            Copy link
          </Button>
          {data.access === "owner" && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => setAccessOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Manage access
              </Button>
              <Button type="button" size="sm" onClick={() => setAddNodeOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add node
              </Button>
              {selectedNodeId && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={deleteNodeMutation.isPending}
                  onClick={() => deleteNodeMutation.mutate(selectedNodeId)}
                >
                  {deleteNodeMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Delete selected
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <PrereadTreeView
        tree={data.tree}
        selectedNodeId={selectedNodeId}
        onSelectNode={(node) => {
          setSelectedNodeId(node.id)
          setModalOpen(true)
        }}
      />

      <PrereadNodeModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        prereadId={id}
        node={selectedNode}
        access={data.access}
      />

      <ManageAccessDialog
        open={accessOpen}
        onOpenChange={setAccessOpen}
        users={users}
        ownerId={data.ownerId}
        memberUserIds={data.members.map((member) => member.userId)}
        saving={membersMutation.isPending}
        onSave={(userIds) => membersMutation.mutate(userIds)}
      />

      <Dialog open={addNodeOpen} onOpenChange={setAddNodeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add node</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="new-node-title">Title</Label>
              <Input
                id="new-node-title"
                value={nodeTitle}
                onChange={(e) => setNodeTitle(e.target.value)}
                placeholder="Node title"
              />
            </div>
            <div className="space-y-2">
              <Label>Kind</Label>
              <Select value={nodeKind} onValueChange={(v) => setNodeKind(v as PrereadNodeKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Parent</Label>
              <Select value={nodeParentId} onValueChange={setNodeParentId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">Root level</SelectItem>
                  {flatNodes.map((node) => (
                    <SelectItem key={node.id} value={node.id}>
                      {node.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddNodeOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createNodeMutation.mutate()}
              disabled={createNodeMutation.isPending || !nodeTitle.trim()}
            >
              {createNodeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add node
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
