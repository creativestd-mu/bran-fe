import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BookOpen, Copy, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { prereadApi } from "@/lib/api"
import type { PrereadSummary } from "@/types"
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
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

function copyShareLink(id: string) {
  const url = `${window.location.origin}/preread/${id}`
  navigator.clipboard.writeText(url).then(
    () => toast.success("Share link copied"),
    () => toast.error("Could not copy link")
  )
}

function PrereadRow({
  item,
  onDelete,
  deleting,
}: {
  item: PrereadSummary
  onDelete: (id: string) => void
  deleting: boolean
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/preread/${item.id}`} className="font-medium hover:underline">
            {item.title}
          </Link>
          <Badge variant={item.access === "owner" ? "default" : "secondary"}>
            {item.access === "owner" ? "Owner" : item.access === "editor" ? "Editor" : "Viewer"}
          </Badge>
        </div>
        {item.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {item.nodeCount} nodes · {item.memberCount} collaborators · updated{" "}
          {new Date(item.updatedAt).toLocaleDateString()}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => copyShareLink(item.id)}>
          <Copy className="mr-2 h-4 w-4" />
          Copy link
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link to={`/preread/${item.id}`}>Open</Link>
        </Button>
        {item.access === "owner" && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={deleting}
            onClick={() => onDelete(item.id)}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  )
}

export default function PrereadsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["prereads"],
    queryFn: () => prereadApi.list(),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      prereadApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["prereads"] })
      setCreateOpen(false)
      setTitle("")
      setDescription("")
      toast.success("Preread created")
      navigate(`/preread/${created.id}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => prereadApi.remove(id),
    onMutate: (id) => setDeletingId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prereads"] })
      toast.success("Preread deleted")
    },
    onSettled: () => setDeletingId(null),
    onError: (err: Error) => toast.error(err.message),
  })

  const owned = useMemo(
    () => (data ?? []).filter((item) => item.access === "owner"),
    [data]
  )
  const shared = useMemo(
    () => (data ?? []).filter((item) => item.access !== "owner"),
    [data]
  )

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-brand text-2xl tracking-wide">Preread</h1>
          <p className="text-sm text-muted-foreground">
            Build tree-shaped prereads, share with teammates, and discuss each node.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New preread
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              Mine
            </h2>
            {owned.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                You have not created any prereads yet.
              </p>
            ) : (
              owned.map((item) => (
                <PrereadRow
                  key={item.id}
                  item={item}
                  deleting={deletingId === item.id}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Shared with me
            </h2>
            {shared.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No shared prereads yet.
              </p>
            ) : (
              shared.map((item) => (
                <PrereadRow
                  key={item.id}
                  item={item}
                  deleting={deletingId === item.id}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))
            )}
          </section>
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create preread</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="preread-title">Title</Label>
              <Input
                id="preread-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Q3 leadership preread"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preread-description">Description</Label>
              <Textarea
                id="preread-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Optional context for collaborators"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !title.trim()}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
