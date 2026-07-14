import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import ForceGraph2D, { type ForceGraphMethods, type NodeObject } from "react-force-graph-2d"
import { formatDistanceToNow } from "date-fns"
import { graphApi } from "@/lib/api"
import type { BrainEdge, BrainGraphData, BrainNode, BrainNodeType } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import {
  Loader2,
  RefreshCw,
  Search,
  X,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"

const CANVAS_BG = "#0b0d10"

const COLOR_FALLBACK: Record<BrainNodeType, string> = {
  member: "#4C8BF5",
  meeting: "#9B6DFF",
  work_unit: "#F5A623",
  work_step: "#F7D060",
  project: "#3DDC97",
  idea: "#FF6BCB",
  theme: "#A0AEC0",
  collaboration: "#E2E8F0",
}

const TYPE_FILTERS: Array<{ key: BrainNodeType | "work"; label: string; types: BrainNodeType[] }> = [
  { key: "member", label: "Members", types: ["member"] },
  { key: "meeting", label: "Meetings", types: ["meeting"] },
  { key: "work", label: "Tasks", types: ["work_unit", "work_step"] },
  { key: "project", label: "Projects", types: ["project"] },
  { key: "idea", label: "Ideas", types: ["idea"] },
  { key: "theme", label: "Themes", types: ["theme"] },
  { key: "collaboration", label: "Collaborations", types: ["collaboration"] },
]

const LEGEND = [
  { type: "member" as const, label: "Member" },
  { type: "meeting" as const, label: "Meeting" },
  { type: "work_unit" as const, label: "Task" },
  { type: "project" as const, label: "Project" },
  { type: "idea" as const, label: "Idea" },
  { type: "theme" as const, label: "Theme" },
  { type: "collaboration" as const, label: "Collab" },
]

const LABEL_VAL_THRESHOLD = 6
const DIM_OPACITY = 0.15

type GraphNode = {
  id: string
  name: string
  val: number
  type: BrainNodeType
  color: string
  meta: BrainNode["meta"]
  x?: number
  y?: number
}

type GraphLink = {
  id: string
  source: string | GraphNode
  target: string | GraphNode
  type: string
  weight: number
  label?: string
}

function nodeColor(node: BrainNode): string {
  return (typeof node.meta?.color === "string" && node.meta.color) || COLOR_FALLBACK[node.type] || "#A0AEC0"
}

function toGraphData(data: BrainGraphData): { nodes: GraphNode[]; links: GraphLink[] } {
  return {
    nodes: data.nodes.map((n) => ({
      id: n.id,
      name: n.label,
      val: Math.min(Math.max(n.val, 1), 24),
      type: n.type,
      color: nodeColor(n),
      meta: n.meta ?? {},
    })),
    links: data.edges.map((e: BrainEdge) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
      weight: e.weight ?? 0.5,
      label: e.label,
    })),
  }
}

function linkEndId(end: string | GraphNode): string {
  return typeof end === "string" ? end : end.id
}

function typeLabel(type: BrainNodeType): string {
  return type.replace(/_/g, " ")
}

export default function BrainMapPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<ForceGraphMethods<NodeObject<GraphNode>, GraphLink> | undefined>(undefined)

  const [size, setSize] = useState({ width: 800, height: 600 })
  const [raw, setRaw] = useState<BrainGraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rebuilding, setRebuilding] = useState(false)

  const [enabledTypes, setEnabledTypes] = useState<Set<string>>(
    () => new Set(TYPE_FILTERS.map((f) => f.key))
  )
  const [showAllLabels, setShowAllLabels] = useState(false)
  const [includeSteps, setIncludeSteps] = useState(false)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [search, setSearch] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)

  const [hoverId, setHoverId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [selected, setSelected] = useState<GraphNode | null>(null)

  const params = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
      includeSteps: includeSteps || undefined,
      limitMeetings: 40,
    }),
    [from, to, includeSteps]
  )

  const loadGraph = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await graphApi.getBrain(params)
      setRaw(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load brain map"
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    loadGraph()
  }, [loadGraph])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const sync = () => {
      const rect = el.getBoundingClientRect()
      setSize({
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(320, Math.floor(rect.height)),
      })
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const baseGraph = useMemo(() => (raw ? toGraphData(raw) : { nodes: [], links: [] }), [raw])

  const allowedTypes = useMemo(() => {
    const types = new Set<BrainNodeType>()
    for (const filter of TYPE_FILTERS) {
      if (enabledTypes.has(filter.key)) {
        for (const t of filter.types) types.add(t)
      }
    }
    return types
  }, [enabledTypes])

  const filteredGraph = useMemo(() => {
    const nodes = baseGraph.nodes.filter((n) => allowedTypes.has(n.type))
    const ids = new Set(nodes.map((n) => n.id))
    const links = baseGraph.links.filter(
      (l) => ids.has(linkEndId(l.source)) && ids.has(linkEndId(l.target))
    )
    return { nodes, links }
  }, [allowedTypes, baseGraph])

  const neighborIds = useMemo(() => {
    if (!focusId) return null
    const set = new Set<string>([focusId])
    for (const link of filteredGraph.links) {
      const s = linkEndId(link.source)
      const t = linkEndId(link.target)
      if (s === focusId) set.add(t)
      if (t === focusId) set.add(s)
    }
    return set
  }, [filteredGraph.links, focusId])

  const searchHits = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return filteredGraph.nodes
      .filter((n) => n.name.toLowerCase().includes(q) || n.type.includes(q))
      .slice(0, 8)
  }, [filteredGraph.nodes, search])

  const focusNode = useCallback(
    (node: GraphNode) => {
      setFocusId(node.id)
      setSelected(node)
      const fg = graphRef.current
      if (fg && typeof node.x === "number" && typeof node.y === "number") {
        fg.centerAt(node.x, node.y, 600)
        fg.zoom(2.2, 600)
      }
    },
    []
  )

  const clearFocus = () => {
    setFocusId(null)
    setSelected(null)
  }

  const handleRebuild = async () => {
    setRebuilding(true)
    try {
      const data = await graphApi.rebuildBrain(params)
      setRaw(data)
      clearFocus()
      toast.success(
        data.cached ? "Brain map refreshed (cached)." : "Brain map rebuilt with AI."
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rebuild brain map")
    } finally {
      setRebuilding(false)
    }
  }

  const toggleFilter = (key: string) => {
    setEnabledTypes((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const paintNode = useCallback(
    (node: NodeObject<GraphNode>, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode
      const x = n.x ?? 0
      const y = n.y ?? 0
      const r = Math.sqrt(n.val) * 2.4
      const focused = !neighborIds || neighborIds.has(n.id)
      const opacity = focused ? 1 : DIM_OPACITY

      ctx.save()
      ctx.globalAlpha = opacity

      // Soft glow
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2)
      glow.addColorStop(0, `${n.color}55`)
      glow.addColorStop(1, `${n.color}00`)
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(x, y, r * 3.2, 0, Math.PI * 2)
      ctx.fill()

      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = n.color
      ctx.shadowColor = n.color
      ctx.shadowBlur = focusId === n.id || hoverId === n.id ? 18 : 10
      ctx.fill()
      ctx.shadowBlur = 0

      const showLabel =
        showAllLabels ||
        n.val >= LABEL_VAL_THRESHOLD ||
        hoverId === n.id ||
        focusId === n.id ||
        selected?.id === n.id

      if (showLabel) {
        const fontSize = Math.max(10 / globalScale, 2.8)
        ctx.font = `${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`
        ctx.textAlign = "center"
        ctx.textBaseline = "top"
        ctx.fillStyle = `rgba(226, 232, 240, ${focused ? 0.92 : 0.25})`
        ctx.fillText(n.name, x, y + r + 2 / globalScale)
      }

      ctx.restore()
    },
    [focusId, hoverId, neighborIds, selected?.id, showAllLabels]
  )

  const paintLink = useCallback(
    (link: GraphLink, ctx: CanvasRenderingContext2D) => {
      const source = link.source as GraphNode
      const target = link.target as GraphNode
      if (typeof source?.x !== "number" || typeof target?.x !== "number") return

      const focused =
        !neighborIds ||
        (neighborIds.has(source.id) && neighborIds.has(target.id))
      const opacity = (focused ? 0.35 : DIM_OPACITY * 0.6) * (0.4 + link.weight * 0.6)
      const width = 0.4 + link.weight * 1.4

      ctx.save()
      ctx.globalAlpha = opacity
      ctx.strokeStyle = "rgba(148, 163, 184, 0.55)"
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.moveTo(source.x!, source.y!)
      ctx.lineTo(target.x!, target.y!)
      ctx.stroke()
      ctx.restore()
    },
    [neighborIds]
  )

  const generatedLabel = raw?.generatedAt
    ? formatDistanceToNow(new Date(raw.generatedAt), { addSuffix: true })
    : null

  return (
    <div ref={containerRef} className="relative h-full min-h-0 w-full flex-1 bg-[#0b0d10]">
      {/* Graph */}
      <div className="absolute inset-0">
        {!loading && filteredGraph.nodes.length > 0 && (
          <ForceGraph2D
            ref={graphRef}
            width={size.width}
            height={size.height}
            graphData={filteredGraph}
            backgroundColor={CANVAS_BG}
            nodeId="id"
            nodeVal="val"
            nodeRelSize={3}
            linkWidth={(l) => 0.4 + ((l as GraphLink).weight ?? 0.5) * 1.4}
            linkColor={() => "rgba(148,163,184,0.25)"}
            linkDirectionalParticles={0}
            cooldownTicks={120}
            d3AlphaDecay={0.022}
            d3VelocityDecay={0.3}
            nodeCanvasObject={paintNode}
            nodeCanvasObjectMode={() => "replace"}
            linkCanvasObject={paintLink}
            linkCanvasObjectMode={() => "replace"}
            onNodeHover={(node) => setHoverId(node ? (node as GraphNode).id : null)}
            onNodeClick={(node) => {
              focusNode(node as GraphNode)
            }}
            onNodeRightClick={(node) => {
              setSelected(node as GraphNode)
              setFocusId((node as GraphNode).id)
            }}
            onBackgroundClick={clearFocus}
          />
        )}
      </div>

      {/* Loading constellation */}
      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-40 w-40">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className="absolute h-2 w-2 rounded-full bg-slate-300/40 animate-pulse"
                style={{
                  left: `${20 + (i % 3) * 28}%`,
                  top: `${18 + Math.floor(i / 3) * 36}%`,
                  animationDelay: `${i * 120}ms`,
                  boxShadow: "0 0 12px rgba(148,163,184,0.45)",
                }}
              />
            ))}
            <p className="absolute inset-x-0 bottom-0 text-center text-xs text-slate-400">
              Mapping your brain…
            </p>
          </div>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filteredGraph.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <p className="max-w-md text-center text-sm leading-relaxed text-slate-400">
            Connect Google Calendar and finish a meeting — Bran will grow this map from notes and
            work.
          </p>
        </div>
      )}

      {/* Error retry */}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-sm text-red-300/90">{error}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 border-slate-600 bg-slate-900/80 text-slate-200 hover:bg-slate-800"
              onClick={loadGraph}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Rebuild overlay */}
      {rebuilding && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0b0d10]/55 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200">
            <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
            Rebuilding with AI…
          </div>
        </div>
      )}

      {/* Top-left controls */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[min(100%-1.5rem,22rem)] flex-col gap-2 sm:left-4 sm:top-4">
        <div className="pointer-events-auto rounded-xl border border-slate-700/50 bg-[#12151a]/88 p-2.5 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setSearchOpen(true)
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search nodes…"
                className="h-8 border-slate-700/60 bg-slate-950/60 pl-8 text-xs text-slate-100 placeholder:text-slate-500"
              />
              {searchOpen && searchHits.length > 0 && (
                <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 overflow-hidden rounded-lg border border-slate-700/60 bg-[#12151a] shadow-2xl">
                  {searchHits.map((hit) => (
                    <button
                      key={hit.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800/80"
                      onClick={() => {
                        focusNode(hit)
                        setSearch(hit.name)
                        setSearchOpen(false)
                      }}
                    >
                      <span className="truncate">{hit.name}</span>
                      <span className="shrink-0 text-slate-500">{typeLabel(hit.type)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 shrink-0 border-slate-700/60 bg-slate-950/60 px-2.5 text-xs text-slate-200 hover:bg-slate-800"
              disabled={rebuilding || loading}
              onClick={handleRebuild}
              title="Force AI rebuild"
            >
              {rebuilding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Rebuild
            </Button>
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            {TYPE_FILTERS.map((filter) => {
              const on = enabledTypes.has(filter.key)
              const color = COLOR_FALLBACK[filter.types[0]]
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => toggleFilter(filter.key)}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[10px] transition-colors",
                    on
                      ? "border-slate-600/80 bg-slate-800/70 text-slate-100"
                      : "border-slate-800 bg-transparent text-slate-500"
                  )}
                >
                  <span
                    className="mr-1 inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: color, opacity: on ? 1 : 0.35 }}
                  />
                  {filter.label}
                </button>
              )
            })}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
            <label className="flex items-center gap-1.5">
              <Switch
                checked={showAllLabels}
                onCheckedChange={setShowAllLabels}
                className="scale-75 origin-left"
              />
              Show labels
            </label>
            <label className="flex items-center gap-1.5">
              <Switch
                checked={includeSteps}
                onCheckedChange={setIncludeSteps}
                className="scale-75 origin-left"
              />
              Steps
            </label>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-7 border-slate-700/60 bg-slate-950/60 px-2 text-[10px] text-slate-300"
            />
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-7 border-slate-700/60 bg-slate-950/60 px-2 text-[10px] text-slate-300"
            />
          </div>
        </div>

        {raw && (
          <div className="pointer-events-none w-fit rounded-md border border-slate-700/40 bg-[#12151a]/70 px-2 py-1 text-[10px] text-slate-400 backdrop-blur">
            <span className={raw.cached ? "text-slate-400" : "text-emerald-400/90"}>
              {raw.cached ? "Cached" : "Fresh"}
            </span>
            {generatedLabel ? ` · ${generatedLabel}` : null}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-xl border border-slate-700/40 bg-[#12151a]/75 px-3 py-2 text-[10px] text-slate-300 backdrop-blur sm:bottom-4 sm:left-4">
        <p className="mb-1.5 font-medium tracking-wide text-slate-400">Legend</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {LEGEND.map((item) => (
            <div key={item.type} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  background: COLOR_FALLBACK[item.type],
                  boxShadow: `0 0 6px ${COLOR_FALLBACK[item.type]}88`,
                }}
              />
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* Hover tooltip */}
      {hoverId && !selected && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-10 max-w-xs rounded-lg border border-slate-700/50 bg-[#12151a]/90 px-3 py-2 text-xs text-slate-200 backdrop-blur sm:bottom-4 sm:right-4">
          {(() => {
            const node = filteredGraph.nodes.find((n) => n.id === hoverId)
            if (!node) return null
            return (
              <>
                <p className="font-medium">{node.name}</p>
                <p className="text-slate-400 capitalize">{typeLabel(node.type)}</p>
              </>
            )
          })()}
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <aside className="absolute bottom-0 right-0 top-0 z-30 flex w-full max-w-sm flex-col border-l border-slate-700/50 bg-[#0f1217]/95 shadow-2xl backdrop-blur-md sm:bottom-3 sm:right-3 sm:top-3 sm:rounded-xl sm:border">
          <div className="flex items-start justify-between gap-2 border-b border-slate-700/40 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-100">{selected.name}</p>
              <p className="mt-0.5 text-xs capitalize text-slate-400">{typeLabel(selected.type)}</p>
            </div>
            <button
              type="button"
              className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              onClick={clearFocus}
              aria-label="Close details"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm text-slate-300">
            <div
              className="inline-flex items-center gap-2 rounded-full border border-slate-700/50 px-2.5 py-1 text-xs"
              style={{ color: selected.color }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: selected.color }} />
              {selected.type}
            </div>

            {selected.type === "member" && (
              <>
                {selected.meta.designation ? (
                  <p>
                    <span className="text-slate-500">Role · </span>
                    {String(selected.meta.designation)}
                  </p>
                ) : null}
                {selected.meta.email ? (
                  <p>
                    <span className="text-slate-500">Email · </span>
                    {String(selected.meta.email)}
                  </p>
                ) : null}
                {selected.meta.entityId ? (
                  <Button asChild size="sm" variant="outline" className="border-slate-600 bg-transparent">
                    <Link to={`/users/${selected.meta.entityId}`}>
                      Open profile
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                ) : null}
              </>
            )}

            {selected.type === "meeting" && (
              <>
                {selected.meta.status ? (
                  <p>
                    <span className="text-slate-500">Status · </span>
                    {String(selected.meta.status)}
                  </p>
                ) : null}
                {selected.meta.startTime ? (
                  <p>
                    <span className="text-slate-500">Start · </span>
                    {new Date(String(selected.meta.startTime)).toLocaleString()}
                  </p>
                ) : null}
                {selected.meta.meetingUrl ? (
                  <a
                    href={String(selected.meta.meetingUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sky-400 hover:underline"
                    title="Opens Google Meet in your browser only — does not send Bran Notetaker"
                  >
                    Open link (you only)
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                {selected.meta.entityId ? (
                  <Button asChild size="sm" variant="outline" className="border-slate-600 bg-transparent">
                    <Link to={`/work?recording=${encodeURIComponent(String(selected.meta.entityId))}`}>
                      View related work
                    </Link>
                  </Button>
                ) : (
                  <Button asChild size="sm" variant="outline" className="border-slate-600 bg-transparent">
                    <Link to="/work">View related work</Link>
                  </Button>
                )}
              </>
            )}

            {selected.type === "work_unit" || selected.type === "work_step" ? (
              <>
                {selected.meta.status ? (
                  <p>
                    <span className="text-slate-500">Status · </span>
                    {String(selected.meta.status)}
                  </p>
                ) : null}
                {selected.meta.entityId ? (
                  <Button asChild size="sm" variant="outline" className="border-slate-600 bg-transparent">
                    <Link to={`/work?unit=${encodeURIComponent(String(selected.meta.entityId))}`}>
                      Open work unit
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                ) : null}
              </>
            ) : null}

            {selected.type === "project" && (
              <>
                {selected.meta.status ? (
                  <p>
                    <span className="text-slate-500">Status · </span>
                    {String(selected.meta.status)}
                  </p>
                ) : null}
                {selected.meta.entityId ? (
                  <Button asChild size="sm" variant="outline" className="border-slate-600 bg-transparent">
                    <Link to={`/projects/${selected.meta.entityId}`}>
                      Open project
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                ) : null}
              </>
            )}

            {(selected.type === "idea" ||
              selected.type === "theme" ||
              selected.type === "collaboration") && (
              <>
                <p className="text-slate-400">{selected.name}</p>
                {selected.meta.aiGenerated ? (
                  <p className="text-xs text-violet-300/80">AI-generated from meeting notes</p>
                ) : null}
              </>
            )}
          </div>
        </aside>
      )}
    </div>
  )
}
