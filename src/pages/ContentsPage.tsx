import { useMemo, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  ChevronRight,
  FileVideo,
  Filter,
  FolderKanban,
  Layers,
  Plus,
  Search,
  User as UserIcon,
  UsersRound,
  X,
} from "lucide-react"
import { contentsApi, projectsApi, teamsApi, verticalsApi } from "@/lib/api"
import type { ContentStatus, ContentType } from "@/types"
import {
  CONTENT_STATUSES,
  CONTENT_STATUS_BADGE,
  CONTENT_TYPE_BADGE,
  CONTENT_TYPES,
  pretty,
} from "@/components/contents/contentMeta"
import { CreateContentDialog } from "@/components/contents/CreateContentDialog"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const ANY = "__any__"

export default function ContentsPage() {
  const [search, setSearch] = useState("")
  const [type, setType] = useState<ContentType | typeof ANY>(ANY)
  const [status, setStatus] = useState<ContentStatus | typeof ANY>(ANY)
  const [verticalId, setVerticalId] = useState<string>(ANY)
  const [projectId, setProjectId] = useState<string>(ANY)
  const [teamId, setTeamId] = useState<string>(ANY)
  const [mineOnly, setMineOnly] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const verticalsQuery = useQuery({ queryKey: ["verticals"], queryFn: () => verticalsApi.list() })
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: () => projectsApi.list() })
  const teamsQuery = useQuery({ queryKey: ["teams"], queryFn: () => teamsApi.list() })

  const verticals = verticalsQuery.data ?? []
  const projects = projectsQuery.data ?? []
  const teams = teamsQuery.data ?? []

  const visibleProjects = useMemo(() => {
    if (verticalId === ANY) return projects
    return projects.filter((p) => p.verticalId === verticalId)
  }, [projects, verticalId])

  const visibleTeams = useMemo(() => {
    if (verticalId === ANY) return teams
    return teams.filter((t) => t.verticalId === verticalId)
  }, [teams, verticalId])

  const params = useMemo(
    () => ({
      type: type === ANY ? undefined : (type as ContentType),
      status: status === ANY ? undefined : (status as ContentStatus),
      verticalId: verticalId === ANY ? undefined : verticalId,
      projectId: projectId === ANY ? undefined : projectId,
      teamId: teamId === ANY ? undefined : teamId,
      mine: mineOnly || undefined,
    }),
    [type, status, verticalId, projectId, teamId, mineOnly]
  )

  const contentsQuery = useQuery({
    queryKey: ["contents", params],
    queryFn: () => contentsApi.list(params),
  })

  const visible = useMemo(() => {
    const items = contentsQuery.data ?? []
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q)
    )
  }, [contentsQuery.data, search])

  const activeAdvancedCount =
    (type !== ANY ? 1 : 0) +
    (status !== ANY ? 1 : 0) +
    (verticalId !== ANY ? 1 : 0) +
    (projectId !== ANY ? 1 : 0) +
    (teamId !== ANY ? 1 : 0)

  const hasActiveFilter =
    Boolean(search) || activeAdvancedCount > 0 || mineOnly

  const resetAll = () => {
    setSearch("")
    setType(ANY)
    setStatus(ANY)
    setVerticalId(ANY)
    setProjectId(ANY)
    setTeamId(ANY)
    setMineOnly(false)
  }

  const resetAdvanced = () => {
    setType(ANY)
    setStatus(ANY)
    setVerticalId(ANY)
    setProjectId(ANY)
    setTeamId(ANY)
  }

  const verticalLabel =
    verticalId !== ANY ? verticals.find((v) => v.id === verticalId)?.name : null
  const projectLabel =
    projectId !== ANY ? projects.find((p) => p.id === projectId)?.name : null
  const teamLabel =
    teamId !== ANY ? teams.find((t) => t.id === teamId)?.name : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-brand text-2xl tracking-wide text-accent">Content</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Productions and coverage pieces with their workflow nodes
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 self-start">
          <Plus className="h-4 w-4" />
          New content
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search title or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-9"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2"
              onClick={() => setFiltersOpen(true)}
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
              {activeAdvancedCount > 0 && (
                <Badge variant="default" className="ml-0.5 h-5 px-1.5 text-[10px]">
                  {activeAdvancedCount}
                </Badge>
              )}
            </Button>

            <div className="ml-auto flex items-center gap-2">
              <div className="flex h-9 items-center gap-2 rounded-md border border-border px-3">
                <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <Label htmlFor="mine-only" className="cursor-pointer text-xs">
                  Mine only
                </Label>
                <Switch id="mine-only" checked={mineOnly} onCheckedChange={setMineOnly} />
              </div>

              {hasActiveFilter && (
                <Button size="sm" variant="ghost" className="h-9" onClick={resetAll}>
                  Clear
                </Button>
              )}
            </div>
          </div>

          {activeAdvancedCount > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {type !== ANY && (
                <FilterChip label={`Type: ${pretty(type as string)}`} onRemove={() => setType(ANY)} />
              )}
              {status !== ANY && (
                <FilterChip
                  label={`Status: ${pretty(status as string)}`}
                  onRemove={() => setStatus(ANY)}
                />
              )}
              {verticalLabel && (
                <FilterChip
                  icon={<Layers className="h-3 w-3" />}
                  label={verticalLabel}
                  onRemove={() => {
                    setVerticalId(ANY)
                    setProjectId(ANY)
                    setTeamId(ANY)
                  }}
                />
              )}
              {projectLabel && (
                <FilterChip
                  icon={<FolderKanban className="h-3 w-3" />}
                  label={projectLabel}
                  onRemove={() => setProjectId(ANY)}
                />
              )}
              {teamLabel && (
                <FilterChip
                  icon={<UsersRound className="h-3 w-3" />}
                  label={teamLabel}
                  onRemove={() => setTeamId(ANY)}
                />
              )}
            </div>
          )}
        </CardHeader>

        <CardContent>
          {contentsQuery.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-36 w-full rounded-lg" />
              ))}
            </div>
          ) : contentsQuery.isError ? (
            <div className="py-10 text-center text-sm text-destructive">
              {(contentsQuery.error as Error)?.message ?? "Failed to load contents"}
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
              <FileVideo className="h-10 w-10 opacity-50" />
              <div className="text-sm">
                {hasActiveFilter
                  ? "No content matches the current filters."
                  : "No content yet — create your first piece."}
              </div>
              {!hasActiveFilter && (
                <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" /> New content
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((content) => {
                const total = content.nodes?.length ?? 0
                const completed = content.nodes?.filter((n) => n.status === "COMPLETED").length ?? 0
                const pendingRentals = content.nodes?.reduce(
                  (sum, n) =>
                    sum +
                    n.resources.filter(
                      (r) => r.sourceType === "RENTAL" && r.approvalState === "PENDING"
                    ).length,
                  0
                ) ?? 0
                return (
                  <Link
                    key={content.id}
                    to={`/contents/${content.id}`}
                    className="group flex flex-col rounded-lg border border-border bg-background p-4 transition-colors hover:border-primary/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <Badge variant={CONTENT_TYPE_BADGE[content.type]}>{pretty(content.type)}</Badge>
                          <Badge variant={CONTENT_STATUS_BADGE[content.status]}>{pretty(content.status)}</Badge>
                          {pendingRentals > 0 && (
                            <Badge variant="warning">
                              {pendingRentals} pending rental{pendingRentals === 1 ? "" : "s"}
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold text-foreground">{content.title}</h3>
                        {content.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{content.description}</p>
                        )}
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                      {content.project?.vertical?.name && (
                        <span className="inline-flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          {content.project.vertical.name}
                        </span>
                      )}
                      {content.project?.name && (
                        <span className="inline-flex items-center gap-1">
                          <FolderKanban className="h-3 w-3" />
                          {content.project.name}
                        </span>
                      )}
                      {content.team?.name && (
                        <span className="inline-flex items-center gap-1">
                          <UsersRound className="h-3 w-3" />
                          {content.team.name}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {total} node{total === 1 ? "" : "s"} · {completed} done
                      </span>
                      {content.createdBy?.name && <span>by {content.createdBy.name}</span>}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateContentDialog open={createOpen} onOpenChange={setCreateOpen} />

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
            <DialogDescription>
              Narrow content by type, status, or organizational scope.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>All types</SelectItem>
                    {CONTENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {pretty(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>All statuses</SelectItem>
                    {CONTENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {pretty(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Vertical</Label>
              <Select
                value={verticalId}
                onValueChange={(v) => {
                  setVerticalId(v)
                  setProjectId(ANY)
                  setTeamId(ANY)
                }}
              >
                <SelectTrigger className="h-9">
                  <Layers className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <SelectValue placeholder="Vertical" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>All verticals</SelectItem>
                  {verticals.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="h-9">
                  <FolderKanban className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>All projects</SelectItem>
                  {visibleProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Team</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger className="h-9">
                  <UsersRound className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <SelectValue placeholder="Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>All teams</SelectItem>
                  {visibleTeams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={resetAdvanced}
              disabled={activeAdvancedCount === 0}
            >
              Reset
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface FilterChipProps {
  label: string
  icon?: ReactNode
  onRemove: () => void
}

function FilterChip({ label, icon, onRemove }: FilterChipProps) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-secondary/50 pl-2.5 pr-1 text-xs text-foreground">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <span className="max-w-[180px] truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}
