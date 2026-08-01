import { useEffect, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  ImagePlus,
  Loader2,
  MessageSquarePlus,
  Pencil,
  Send,
  Trash2,
  X,
} from "lucide-react"
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
import { cn } from "@/lib/utils"
import { usePrereadMediaUrl, revokePrereadMediaUrl } from "./usePrereadMediaUrl"
import "./preread.css"

const KIND_OPTIONS: { value: PrereadNodeKind; label: string }[] = [
  { value: "output", label: "Output" },
  { value: "blocker", label: "Blocker" },
  { value: "advice", label: "Advice" },
]

const KIND_LABELS: Record<PrereadNodeKind, string> = {
  output: "Output",
  blocker: "Blocker",
  advice: "Advice",
}

function MediaSlide({
  prereadId,
  nodeId,
  media,
}: {
  prereadId: string
  nodeId: string
  media: PrereadTreeNode["media"][number]
}) {
  const { url, loading, error } = usePrereadMediaUrl(prereadId, nodeId, media.id)

  return (
    <div className="preread-read-media-slide">
      {loading && (
        <div className="flex h-full min-h-[220px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {!loading && error && (
        <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-muted-foreground">
          Failed to load media
        </div>
      )}
      {!loading && url && media.mediaType === "image" && (
        <img src={url} alt={media.filename} />
      )}
      {!loading && url && media.mediaType === "video" && (
        <video src={url} controls playsInline preload="metadata" />
      )}
    </div>
  )
}

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

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [kind, setKind] = useState<PrereadNodeKind>("output")
  const [commentBody, setCommentBody] = useState("")
  const [commentComposerOpen, setCommentComposerOpen] = useState(false)
  const [activeMediaIndex, setActiveMediaIndex] = useState(0)
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null)

  useEffect(() => {
    if (!node || !open) return
    setTitle(node.title)
    setDescription(node.description ?? "")
    setKind(node.kind)
    setCommentBody("")
    setCommentComposerOpen(false)
    setEditing(false)
    setActiveMediaIndex(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id, open])

  useEffect(() => {
    if (!node) return
    if (activeMediaIndex >= node.media.length) {
      setActiveMediaIndex(Math.max(0, node.media.length - 1))
    }
  }, [node, activeMediaIndex])

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
      setEditing(false)
      toast.success("Node saved")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const commentMutation = useMutation({
    mutationFn: () => prereadApi.createComment(prereadId, node!.id, commentBody.trim()),
    onSuccess: () => {
      setCommentBody("")
      setCommentComposerOpen(false)
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

  const isOwner = access === "owner"
  const canDeleteComment = (authorId: string) =>
    isOwner || authorId === user?.id
  const hasMedia = node.media.length > 0
  const activeMedia = hasMedia ? node.media[activeMediaIndex] : null
  const displayDescription = node.description?.trim() || "No description yet."
  const showEditor = isOwner && editing

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0",
          hasMedia && !showEditor ? "max-w-5xl" : "max-w-2xl"
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="min-w-0 space-y-1">
              <DialogTitle className="truncate text-lg">{node.title}</DialogTitle>
              <span className={cn("preread-kind-badge", `kind-${node.kind}`)}>
                {KIND_LABELS[node.kind]}
              </span>
            </div>
            {isOwner && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setEditing((v) => !v)}
              >
                {editing ? (
                  <>
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    Cancel edit
                  </>
                ) : (
                  <>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {showEditor ? (
            <div className="space-y-4 p-5">
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
                  rows={8}
                  placeholder="What should readers know about this node?"
                />
              </div>

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

              <Button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !title.trim()}
              >
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save node
              </Button>
            </div>
          ) : (
            <div className="flex min-h-[420px] flex-col">
              <div
                className={cn(
                  "grid min-h-0 flex-1",
                  hasMedia ? "lg:grid-cols-[7fr_3fr]" : "grid-cols-1"
                )}
              >
                {hasMedia && activeMedia && (
                  <div className="preread-read-media-pane border-b border-border lg:border-b-0 lg:border-r">
                    <MediaSlide
                      prereadId={prereadId}
                      nodeId={node.id}
                      media={activeMedia}
                    />
                    {node.media.length > 1 && (
                      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2">
                        {node.media.map((media, index) => (
                          <button
                            key={media.id}
                            type="button"
                            className={cn(
                              "rounded-md border px-2 py-1 text-xs transition",
                              index === activeMediaIndex
                                ? "border-accent bg-accent/15 text-foreground"
                                : "border-border text-muted-foreground hover:bg-muted"
                            )}
                            onClick={() => setActiveMediaIndex(index)}
                          >
                            {media.mediaType === "video" ? "Video" : "Image"} {index + 1}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div
                  className={cn(
                    "flex min-h-0 flex-col",
                    hasMedia ? "p-5" : "px-6 py-6 sm:px-8 sm:py-8"
                  )}
                >
                  <p
                    className={cn(
                      "whitespace-pre-wrap leading-relaxed text-foreground",
                      hasMedia
                        ? "min-h-[280px] flex-1 overflow-y-auto text-[0.95rem]"
                        : "min-h-[320px] flex-1 text-base sm:text-lg"
                    )}
                  >
                    {displayDescription}
                  </p>
                </div>
              </div>

              <div className="shrink-0 space-y-3 border-t border-border px-5 py-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    Comments
                    {node.comments.length > 0 && (
                      <span className="ml-1.5 text-muted-foreground">({node.comments.length})</span>
                    )}
                  </p>
                  {!commentComposerOpen && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCommentComposerOpen(true)}
                    >
                      <MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" />
                      Add comment
                    </Button>
                  )}
                </div>

                {node.comments.length > 0 && (
                  <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                    {node.comments.map((comment) => (
                      <div key={comment.id} className="flex gap-2 rounded-md border p-2">
                        <Avatar className="h-7 w-7">
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
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {node.comments.length === 0 && !commentComposerOpen && (
                  <p className="text-sm text-muted-foreground">No comments yet.</p>
                )}

                {commentComposerOpen && (
                  <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                    <Textarea
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      rows={3}
                      autoFocus
                      placeholder="Add a comment…"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCommentComposerOpen(false)
                          setCommentBody("")
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={commentMutation.isPending || !commentBody.trim()}
                        onClick={() => commentMutation.mutate()}
                      >
                        {commentMutation.isPending ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Post
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
