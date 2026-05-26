import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useParams } from "react-router-dom"
import { ChevronLeft, Users } from "lucide-react"
import { projectsApi, usersApi } from "@/lib/api"
import { HierarchyCanvas } from "@/components/hierarchy/HierarchyCanvas"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

export default function ProjectDetailPage() {
  const { id = "" } = useParams<{ id: string }>()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [savingDetails, setSavingDetails] = useState(false)

  const projectQuery = useQuery({
    queryKey: ["project-details-page", id],
    queryFn: () => projectsApi.getById(id),
    enabled: Boolean(id),
  })

  const usersQuery = useQuery({
    queryKey: ["users-palette-project-detail"],
    queryFn: async () => (await usersApi.list({ page: 1, pageSize: 200 })).items,
  })

  useEffect(() => {
    if (!projectQuery.data) return
    setName(projectQuery.data.name)
    setDescription(projectQuery.data.description ?? "")
  }, [projectQuery.data])

  if (!id) {
    return <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">Invalid project id.</div>
  }

  if (projectQuery.isLoading || usersQuery.isLoading) {
    return <Skeleton className="h-[74vh] w-full" />
  }

  if (!projectQuery.data) {
    return <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">Project not found.</div>
  }

  const project = projectQuery.data
  const detailsChanged = name.trim() !== project.name || (description.trim() || "") !== (project.description ?? "")

  const saveDetails = async () => {
    const nextName = name.trim()
    if (!nextName) {
      toast.error("Project name is required")
      return
    }

    setSavingDetails(true)
    try {
      await projectsApi.update(project.id, {
        name: nextName,
        description: description.trim() || undefined,
      })
      toast.success("Project details updated")
      await projectQuery.refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update project")
    } finally {
      setSavingDetails(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link to="/projects">
            <ChevronLeft className="h-4 w-4" /> Back to projects
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="font-brand text-2xl tracking-wide text-accent">Project Details</h1>
              <Badge variant="outline" className="gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {project.members?.length ?? 0} members
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="project-name">Title</Label>
                  <Input id="project-name" value={name} onChange={(event) => setName(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-description">Description</Label>
                  <Textarea
                    id="project-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                    placeholder="No description provided."
                  />
                </div>
              </div>
              <div className="flex items-end gap-2 md:flex-col md:items-stretch md:justify-end">
                <Button
                  variant="outline"
                  disabled={savingDetails || !detailsChanged}
                  onClick={() => {
                    setName(project.name)
                    setDescription(project.description ?? "")
                  }}
                >
                  Cancel
                </Button>
                <Button disabled={savingDetails || !detailsChanged} onClick={saveDetails}>
                  {savingDetails ? "Saving..." : "Save details"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <HierarchyCanvas
        kind="project"
        contextId={project.id}
        members={project.members ?? []}
        users={usersQuery.data ?? []}
        adapter={{
          addMember: projectsApi.addMember,
          updateMember: projectsApi.updateMember,
          deleteMember: projectsApi.deleteMember,
          upsertGraph: async (contextId, data) => {
            await projectsApi.upsertHierarchy({
              projectId: contextId,
              name,
              description: description.trim() || undefined,
              members: data.members,
            })
          },
        }}
        onReload={async () => {
          await projectQuery.refetch()
        }}
      />
    </div>
  )
}
