import { useEffect, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ImagePlus, Loader2, Send, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { prereadApi } from "@/lib/api"
import type { PrereadAccess, PrereadNodeKind, PrereadTreeNode } from "@/types"
import { useAuth } from "@/contexts/AuthContext"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea"
import { usePrereadMediaUrl, revokePrereadMediaUrl } from "./usePrereadMediaUrl"
import "./preread.css"

const KIND_OPTIONS: { value: PrereadNodeKind; label: string }[] = [
  { value: "output", label: "Output" },
  { value: "blocker", label: "Blocker" },
  { value: "advice", label: "Advice" },
]

function MediaPreview({
  prereadId,
  nodeId,
  media,
  onDelete,
  deleting,
}: {
  prereadId: string
  nodeId: string
  media: PrereadTreeNode["media"][number]
  onDelete: () => void
  deleting: boolean
}) {
  const { url, loading, error } = usePrereadMediaUrl(prereadId, nodeId, media.id)

  return (
    <div className="preread-media-item">
      {loading && (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {!loading && error && (
        <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
          Failed to load media
        </div>
      )}
      {!loading && url && media.mediaType === "image" && (
        <img src={url} alt={media.filename} loading="lazy" />
      )}
      {!loading && url && media.mediaType === "video" && (
        <video src={url} controls playsInline preload="metadata" />
      )}
      <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
        <span className="truncate text-xs text-muted-foreground">{media.filename}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          disabled={deleting}
          onClick={onDelete}
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  )
}

interface PrereadNodeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prereadId: string
  node: PrereadTreeNode | null
  access: PrereadAccess
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function PrereadNodeModal({
  open,
  onOpenChange,
  prereadId,
  node,
  access,
}: PrereadNodeModalProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [kind, setKind] = useState<PrereadNodeKind>("output")
  const [commentBody, setCommentBody] = useState("")
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null)

  // Reset the editable fields when a *different* node is opened, or when the
  // dialog is (re)opened — but not on every background refetch (e.g. after a
  // comment or media upload), otherwise unsaved edits get discarded.
  useEffect(() => {
    if (!node || !open) return
    setTitle(node.title)
    setDescription(node.description ?? "")
    setKind(node.kind)
    setCommentBody("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id, open])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["preread", prereadId] })
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      prereadApi.updateNode(prereadId, node!.id, {
        title: title.trim(),
        description: description.trim() || null,
        kind,
      }),
    onSuccess: () => {
      invalidate()
      toast.success("Node saved")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const commentMutation = useMutation({
    mutationFn: () => prereadApi.createComment(prereadId, node!.id, commentBody.trim()),
    onSuccess: () => {
      setCommentBody("")
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => prereadApi.uploadMedia(prereadId, node!.id, file),
    onSuccess: () => {
      invalidate()
      toast.success("Media uploaded")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) =>
      prereadApi.deleteComment(prereadId, node!.id, commentId),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMediaMutation = useMutation({
    mutationFn: (mediaId: string) => prereadApi.deleteMedia(prereadId, node!.id, mediaId),
    onMutate: (mediaId) => setDeletingMediaId(mediaId),
    onSuccess: (_data, mediaId) => {
      revokePrereadMediaUrl(prereadId, node!.id, mediaId)
      invalidate()
    },
    onSettled: () => setDeletingMediaId(null),
    onError: (err: Error) => toast.error(err.message),
  })

  if (!node) return null

  const canDeleteComment = (authorId: string) =>
    access === "owner" || authorId === user?.id

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Node details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <div className="space-y-2">
              <Label htmlFor="preread-node-title">Title</Label>
              <Input
                id="preread-node-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as PrereadNodeKind)}>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="preread-node-description">Description</Label>
            <Textarea
              id="preread-node-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="What should readers know about this node?"
            />
          </div>

          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !title.trim()}
          >
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save node
          </Button>

          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between gap-2">
              <Label>Media</Label>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadMutation.mutate(file)
                    e.target.value = ""
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadMutation.isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="mr-2 h-4 w-4" />
                  )}
                  Upload image or video
                </Button>
              </div>
            </div>

            {node.media.length === 0 ? (
              <p className="text-sm text-muted-foreground">No media attached yet.</p>
            ) : (
              <div className="preread-media-grid">
                {node.media.map((media) => (
                  <MediaPreview
                    key={media.id}
                    prereadId={prereadId}
                    nodeId={node.id}
                    media={media}
                    deleting={deletingMediaId === media.id}
                    onDelete={() => deleteMediaMutation.mutate(media.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 border-t pt-4">
            <Label>Comments</Label>
            <div className="max-h-56 space-y-3 overflow-y-auto pr-1">
              {node.comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              ) : (
                node.comments.map((comment) => (
                  <div key={comment.id} className="flex gap-2 rounded-md border p-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={comment.author.avatarUrl ?? undefined} />
                      <AvatarFallback>{initials(comment.author.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{comment.author.name}</p>
                        {canDeleteComment(comment.author.id) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => deleteCommentMutation.mutate(comment.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {comment.body}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground/80">
                        {new Date(comment.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <Textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                rows={2}
                placeholder="Add a comment…"
              />
              <Button
                type="button"
                size="icon"
                className="shrink-0 self-end"
                disabled={commentMutation.isPending || !commentBody.trim()}
                onClick={() => commentMutation.mutate()}
              >
                {commentMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
