import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Sparkles, UsersRound } from "lucide-react"
import { toast } from "sonner"
import { ideationApi } from "@/lib/api"
import type { CreateIdeaRequest, IdeaItem, RecommendationItem } from "@/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const DEFAULT_PAGE_SIZE = 20
const MAX_TAGS = 20
const MAX_TAG_LENGTH = 100

function parseTags(raw: string): string[] {
  const unique = new Set<string>()
  for (const item of raw.split(",")) {
    const trimmed = item.trim()
    if (!trimmed) continue
    if (trimmed.length > MAX_TAG_LENGTH) continue
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

function scoreLabel(score: number): { text: string; variant: "success" | "warning" | "secondary" } {
  if (score >= 0.85) return { text: "High match", variant: "success" }
  if (score >= 0.7) return { text: "Strong match", variant: "warning" }
  return { text: "Possible match", variant: "secondary" }
}

export default function IdeationPage() {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [tagsText, setTagsText] = useState("")

  const ideasQuery = useQuery({
    queryKey: ["ideation", "ideas", DEFAULT_PAGE_SIZE],
    queryFn: () => ideationApi.listMyIdeas({ take: DEFAULT_PAGE_SIZE, skip: 0 }),
  })

  const recommendationsQuery = useQuery({
    queryKey: ["ideation", "recommendations", DEFAULT_PAGE_SIZE],
    queryFn: () => ideationApi.listMyRecommendations({ take: DEFAULT_PAGE_SIZE, skip: 0 }),
  })

  const createIdeaMutation = useMutation({
    mutationFn: (payload: CreateIdeaRequest) => ideationApi.createIdea(payload),
    onSuccess: (createdIdea) => {
      toast.success("Idea saved and matching started")
      setTitle("")
      setDescription("")
      setTagsText("")

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

  const parsedTags = useMemo(() => parseTags(tagsText), [tagsText])
  const hasValidForm = title.trim().length > 0 && description.trim().length > 0

  const handleCreateIdea = () => {
    if (!hasValidForm) {
      toast.error("Title and description are required")
      return
    }

    createIdeaMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      tags: parsedTags.length > 0 ? parsedTags : undefined,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-brand text-2xl tracking-wide text-accent">Ideation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Capture ideas, store semantic context, and discover teammates working on similar concepts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add a new idea</CardTitle>
          <CardDescription>
            Your idea is saved immediately. Similarity matching runs right after save.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="idea-title">Title</Label>
            <Input
              id="idea-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={500}
              placeholder="AI content ideation board"
            />
            <p className="text-xs text-muted-foreground">{title.length}/500</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="idea-description">Description</Label>
            <Textarea
              id="idea-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={8000}
              className="min-h-[140px]"
              placeholder="A place to crowdsource newsletter ideas and rank them."
            />
            <p className="text-xs text-muted-foreground">{description.length}/8000</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="idea-tags">Tags (comma separated)</Label>
            <Input
              id="idea-tags"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="ai, newsletter, collaboration"
            />
            <div className="flex flex-wrap gap-1.5">
              {parsedTags.map((tag) => (
                <Badge key={tag} variant="outline">{tag}</Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Up to {MAX_TAGS} tags. Tags longer than {MAX_TAG_LENGTH} characters are ignored.
            </p>
          </div>

          <Button
            onClick={handleCreateIdea}
            disabled={createIdeaMutation.isPending}
            className="gap-2"
          >
            {createIdeaMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {createIdeaMutation.isPending ? "Saving..." : "Save idea"}
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="ideas" className="space-y-3">
        <TabsList>
          <TabsTrigger value="ideas">My ideas</TabsTrigger>
          <TabsTrigger value="matches">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="ideas">
          <Card>
            <CardHeader>
              <CardTitle>My ideas</CardTitle>
            </CardHeader>
            <CardContent>
              {ideasQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : ideasQuery.isError ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  {(ideasQuery.error as Error)?.message ?? "Failed to load ideas"}
                </div>
              ) : (ideasQuery.data?.length ?? 0) === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No ideas yet. Add your first idea to start receiving matches.
                </div>
              ) : (
                <div className="space-y-3">
                  {(ideasQuery.data ?? []).map((idea) => (
                    <article key={idea.id} className="rounded-lg border border-border p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-foreground">{idea.title}</h3>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {new Date(idea.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                        {idea.description}
                      </p>
                      {idea.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {idea.tags.map((tag) => (
                            <Badge key={`${idea.id}-${tag}`} variant="outline">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matches">
          <Card>
            <CardHeader>
              <CardTitle>Recommended collaborators</CardTitle>
              <CardDescription>
                Ranked from idea similarity score and status from the backend matching pipeline.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recommendationsQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-44 w-full" />
                  <Skeleton className="h-44 w-full" />
                </div>
              ) : recommendationsQuery.isError ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  {(recommendationsQuery.error as Error)?.message ?? "Failed to load recommendations"}
                </div>
              ) : (recommendationsQuery.data?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                  <UsersRound className="h-8 w-8 opacity-50" />
                  No recommendations yet. Post more ideas to improve matches.
                </div>
              ) : (
                <div className="space-y-3">
                  {(recommendationsQuery.data ?? []).map((item) => (
                    <RecommendationCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function RecommendationCard({ item }: { item: RecommendationItem }) {
  const scoreMeta = scoreLabel(item.score)
  const userLabel = item.matchedUser.designation ? `${item.matchedUser.name} · ${item.matchedUser.designation}` : item.matchedUser.name

  return (
    <article className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2">
          <Badge variant={scoreMeta.variant}>{scoreMeta.text}</Badge>
          <Badge variant="outline">{item.status}</Badge>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Similarity {(item.score * 100).toFixed(1)}%
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(item.createdAt).toLocaleString()}
        </span>
      </div>

      <div className="mt-4 rounded-md border border-border/70 bg-secondary/20 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Match with</p>
        <div className="mt-2 flex items-center gap-3">
          <Avatar className="h-9 w-9">
            {item.matchedUser.avatarUrl && <AvatarImage src={item.matchedUser.avatarUrl} alt={item.matchedUser.name} />}
            <AvatarFallback>{initials(item.matchedUser.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{userLabel}</p>
            <p className="truncate text-xs text-muted-foreground">{item.matchedUser.email}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <IdeaSnippet title="Your idea" idea={item.sourceIdea} />
        <IdeaSnippet title="Matched idea" idea={item.matchedIdea} />
      </div>
    </article>
  )
}

function IdeaSnippet({ title, idea }: { title: string; idea: RecommendationItem["sourceIdea"] }) {
  return (
    <section className="rounded-md border border-border/70 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <h4 className="mt-1 text-sm font-semibold">{idea.title}</h4>
      <p className="mt-1 line-clamp-4 text-xs text-muted-foreground">{idea.description}</p>
      {idea.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {idea.tags.map((tag) => (
            <Badge key={`${idea.id}-${tag}`} variant="outline" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </section>
  )
}
