import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { contentsApi, projectsApi, teamsApi } from "@/lib/api"
import type { ContentType } from "@/types"
import {
  CONTENT_TYPES,
  PRODUCTION_PRESET,
  pretty,
} from "@/components/contents/contentMeta"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const empty = {
  title: "",
  description: "",
  type: "PRODUCTION" as ContentType,
  seedNodes: true,
  projectId: "",
  teamId: "",
}

export function CreateContentDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(empty)

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.list(),
    enabled: open,
  })

  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: () => teamsApi.list(),
    enabled: open,
  })

  const projects = projectsQuery.data ?? []
  const teams = teamsQuery.data ?? []

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === form.projectId) ?? null,
    [projects, form.projectId]
  )

  // Teams are filtered to those that share the selected project's vertical.
  const eligibleTeams = useMemo(() => {
    if (!selectedProject?.verticalId) return teams
    return teams.filter((t) => t.verticalId === selectedProject.verticalId)
  }, [teams, selectedProject])

  // If the selected team no longer matches the project's vertical, clear it.
  useEffect(() => {
    if (!form.teamId) return
    if (!selectedProject?.verticalId) return
    const team = teams.find((t) => t.id === form.teamId)
    if (team && team.verticalId !== selectedProject.verticalId) {
      setForm((p) => ({ ...p, teamId: "" }))
    }
  }, [selectedProject, teams, form.teamId])

  const reset = () => setForm(empty)

  const createMutation = useMutation({
    mutationFn: async () => {
      const content = await contentsApi.create({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        teamId: form.teamId,
        projectId: form.projectId,
      })
      if (form.type === "PRODUCTION" && form.seedNodes) {
        for (let i = 0; i < PRODUCTION_PRESET.length; i++) {
          const preset = PRODUCTION_PRESET[i]
          await contentsApi.createNode(content.id, {
            kind: preset.kind,
            name: preset.name,
            orderIndex: i,
          })
        }
      }
      return content
    },
    onSuccess: (content) => {
      toast.success("Content created")
      queryClient.invalidateQueries({ queryKey: ["contents"] })
      onOpenChange(false)
      reset()
      navigate(`/contents/${content.id}`)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create content")
    },
  })

  const submit = () => {
    if (!form.title.trim()) {
      toast.error("Title is required")
      return
    }
    if (!form.projectId) {
      toast.error("Project is required")
      return
    }
    if (!form.teamId) {
      toast.error("Team is required")
      return
    }
    createMutation.mutate()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New content</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              value={form.title}
              placeholder="Summer launch reel"
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              rows={3}
              value={form.description}
              placeholder="Optional brief or context"
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Project *</Label>
              <Select
                value={form.projectId}
                onValueChange={(value) => setForm((p) => ({ ...p, projectId: value }))}
                disabled={projectsQuery.isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={projectsQuery.isLoading ? "Loading..." : "Select project"} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Team *</Label>
              <Select
                value={form.teamId}
                onValueChange={(value) => setForm((p) => ({ ...p, teamId: value }))}
                disabled={teamsQuery.isLoading || !form.projectId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !form.projectId
                        ? "Pick a project first"
                        : eligibleTeams.length === 0
                          ? "No teams in this vertical"
                          : "Select team"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {eligibleTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProject && eligibleTeams.length === 0 && (
                <p className="text-xs text-amber-500">
                  No active teams share this project's vertical. Create or assign a team first.
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Type *</Label>
            <Select
              value={form.type}
              onValueChange={(value) => setForm((p) => ({ ...p, type: value as ContentType }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {pretty(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.type === "PRODUCTION" && (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3">
              <div className="space-y-1">
                <Label className="cursor-pointer">Seed default nodes</Label>
                <p className="text-xs text-muted-foreground">
                  Adds Scripting → Shoot → Editing in order. You can edit, reorder, or delete them later.
                </p>
              </div>
              <Switch
                checked={form.seedNodes}
                onCheckedChange={(checked) => setForm((p) => ({ ...p, seedNodes: checked }))}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
