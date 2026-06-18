import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Lightbulb, Loader2, Mic, MicOff, Plus, Users } from "lucide-react"
import { toast } from "sonner"
import { ideationApi } from "@/lib/api"
import { firstValidationError, validateRequiredText } from "@/lib/validation"
import type { CreateIdeaRequest, IdeaItem, RecommendationItem } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// ─── Voice-to-text hook ───────────────────────────────────────────────────────

type VoiceTarget = "title" | "description" | null

function useSpeechRecognition(
  onResult: (target: VoiceTarget, text: string) => void
) {
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const [listening, setListening] = useState<VoiceTarget>(null)
  const targetRef = useRef<VoiceTarget>(null)

  const supported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)

  useEffect(() => {
    if (!supported) return
    const SR =
      (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition!
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = false
    rec.lang = "en-US"
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(" ")
        .trim()
      if (text && targetRef.current) onResult(targetRef.current, text)
    }
    rec.onerror = () => {
      setListening(null)
      targetRef.current = null
    }
    rec.onend = () => {
      setListening(null)
      targetRef.current = null
    }
    recognitionRef.current = rec
    return () => rec.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported])

  const toggle = useCallback(
    (target: VoiceTarget) => {
      const rec = recognitionRef.current
      if (!rec) {
        toast.error("Voice input not supported in this browser")
        return
      }
      if (listening === target) {
        rec.stop()
        setListening(null)
        targetRef.current = null
      } else {
        if (listening) rec.stop()
        targetRef.current = target
        setListening(target)
        rec.start()
      }
    },
    [listening]
  )

  return { supported, listening, toggle }
}

const DEFAULT_PAGE_SIZE = 20
const MAX_TAGS = 20
const MAX_TAG_LENGTH = 100

function parseTags(raw: string): string[] {
  const unique = new Set<string>()
  for (const item of raw.split(",")) {
    const trimmed = item.trim()
    if (!trimmed || trimmed.length > MAX_TAG_LENGTH) continue
    unique.add(trimmed)
    if (unique.size >= MAX_TAGS) break
  }
  return [...unique]
}

function initials(name: string): string {
  const chunks = name.trim().split(/\s+/).filter(Boolean)
  if (chunks.length === 0) return "?"
  if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase()
  return `${chunks[0][0]}${chunks[chunks.length - 1][0]}`.toUpperCase()
}

export default function IdeationPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [tagsText, setTagsText] = useState("")

  const { supported: voiceSupported, listening, toggle: toggleVoice } = useSpeechRecognition(
    (target, text) => {
      if (target === "title") setTitle((p) => (p ? `${p} ${text}` : text))
      if (target === "description") setDescription((p) => (p ? `${p} ${text}` : text))
    }
  )

  const ideasQuery = useQuery({
    queryKey: ["ideation", "ideas", DEFAULT_PAGE_SIZE],
    queryFn: () => ideationApi.listMyIdeas({ take: DEFAULT_PAGE_SIZE, skip: 0 }),
  })

  const recommendationsQuery = useQuery({
    queryKey: ["ideation", "recommendations", DEFAULT_PAGE_SIZE],
    queryFn: () => ideationApi.listMyRecommendations({ take: DEFAULT_PAGE_SIZE, skip: 0 }),
  })

  const parsedTags = useMemo(() => parseTags(tagsText), [tagsText])

  const createIdeaMutation = useMutation({
    mutationFn: (payload: CreateIdeaRequest) => ideationApi.createIdea(payload),
    onSuccess: (createdIdea) => {
      toast.success("Idea saved")
      setTitle("")
      setDescription("")
      setTagsText("")
      setCreateOpen(false)
      queryClient.setQueryData<IdeaItem[]>(
        ["ideation", "ideas", DEFAULT_PAGE_SIZE],
        (existing) => [createdIdea, ...(existing ?? [])]
      )
      queryClient.invalidateQueries({ queryKey: ["ideation", "recommendations"] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create idea")
    },
  })

  const handleCreateIdea = () => {
    const validationError = firstValidationError(
      validateRequiredText(title, "Title"),
      validateRequiredText(description, "Description")
    )
    if (validationError) {
      toast.error(validationError)
      return
    }
    createIdeaMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      tags: parsedTags.length > 0 ? parsedTags : undefined,
    })
  }

  const ideas = ideasQuery.data ?? []
  const matches = recommendationsQuery.data ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-brand text-2xl tracking-wide text-accent">Ideation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Capture ideas and discover teammates with similar directions.
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New idea
        </Button>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* My Ideas */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Lightbulb className="h-4 w-4 text-accent" />
            My Ideas
            {ideas.length > 0 && (
              <span className="ml-auto text-xs text-muted-foreground">{ideas.length}</span>
            )}
          </div>

          {ideasQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : ideasQuery.isError ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {(ideasQuery.error as Error)?.message ?? "Failed to load ideas"}
            </p>
          ) : ideas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 py-12 text-center">
              <p className="text-sm text-muted-foreground">No ideas yet — add your first one.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card/60">
              {ideas.map((idea) => (
                <IdeaRow key={idea.id} idea={idea} />
              ))}
            </div>
          )}
        </div>

        {/* Matches */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Users className="h-4 w-4 text-accent" />
            Matches
            {matches.length > 0 && (
              <span className="ml-auto text-xs text-muted-foreground">{matches.length}</span>
            )}
          </div>

          {recommendationsQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : recommendationsQuery.isError ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {(recommendationsQuery.error as Error)?.message ?? "Failed to load matches"}
            </p>
          ) : matches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                Add more ideas to surface matches.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card/60">
              {matches.map((item) => (
                <MatchRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>New idea</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="idea-title">Title *</Label>
              <div className="flex gap-2">
                <Input
                  id="idea-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={500}
                  placeholder="Short title"
                  autoFocus
                  className="flex-1"
                />
                {voiceSupported && (
                  <Button
                    type="button"
                    variant={listening === "title" ? "default" : "outline"}
                    size="icon"
                    className={`shrink-0 transition-colors ${listening === "title" ? "animate-pulse bg-red-500 hover:bg-red-600 border-red-500" : ""}`}
                    onClick={() => toggleVoice("title")}
                    title={listening === "title" ? "Stop recording" : "Dictate title"}
                  >
                    {listening === "title" ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="idea-description">Description *</Label>
                {voiceSupported && (
                  <button
                    type="button"
                    onClick={() => toggleVoice("description")}
                    className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-xs transition-colors ${
                      listening === "description"
                        ? "animate-pulse bg-red-500/15 text-red-500"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title={listening === "description" ? "Stop recording" : "Dictate description"}
                  >
                    {listening === "description" ? (
                      <>
                        <MicOff className="h-3 w-3" />
                        Recording…
                      </>
                    ) : (
                      <>
                        <Mic className="h-3 w-3" />
                        Dictate
                      </>
                    )}
                  </button>
                )}
              </div>
              <Textarea
                id="idea-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={8000}
                rows={7}
                placeholder="What are you thinking about?"
                className={listening === "description" ? "ring-2 ring-red-500/40" : ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="idea-tags">
                Tags{" "}
                <span className="text-muted-foreground">(optional, comma-separated)</span>
              </Label>
              <Input
                id="idea-tags"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="ai, newsletter, product"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={createIdeaMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateIdea}
              disabled={createIdeaMutation.isPending}
              className="gap-2"
            >
              {createIdeaMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function IdeaRow({ idea }: { idea: IdeaItem }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{idea.title}</p>
        <time className="shrink-0 text-xs text-muted-foreground">
          {new Date(idea.createdAt).toLocaleDateString()}
        </time>
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{idea.description}</p>
      {idea.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {idea.tags.map((tag) => (
            <Badge
              key={`${idea.id}-${tag}`}
              variant="outline"
              className="px-1.5 py-0 text-[10px] font-normal"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function MatchRow({ item }: { item: RecommendationItem }) {
  const pct = (item.score * 100).toFixed(0)
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Avatar className="h-8 w-8 shrink-0 border border-border/50">
        {item.matchedUser.avatarUrl && (
          <AvatarImage src={item.matchedUser.avatarUrl} alt={item.matchedUser.name} />
        )}
        <AvatarFallback className="text-[10px]">{initials(item.matchedUser.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground">{item.matchedUser.name}</p>
          <span className="shrink-0 text-xs font-medium text-accent">{pct}%</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {item.matchedIdea.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground/70">
          from: {item.sourceIdea.title}
        </p>
      </div>
    </div>
  )
}
