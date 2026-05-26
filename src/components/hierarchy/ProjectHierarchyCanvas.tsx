import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { projectsApi, usersApi } from "@/lib/api"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { HierarchyCanvas } from "./HierarchyCanvas"

export function ProjectHierarchyCanvas() {
  const [projectId, setProjectId] = useState<string>("")

  const projectsQuery = useQuery({
    queryKey: ["projects-list"],
    queryFn: projectsApi.list,
  })

  const usersQuery = useQuery({
    queryKey: ["users-palette-project"],
    queryFn: async () => (await usersApi.list({ page: 1, pageSize: 200 })).items,
  })

  const projects = projectsQuery.data ?? []
  const selectedProjectId = projectId || projects[0]?.id || ""
  const projectPlaceholder = projectsQuery.isError ? "Unable to load projects" : "No projects available"

  const projectQuery = useQuery({
    queryKey: ["project-details", selectedProjectId],
    queryFn: () => projectsApi.getById(selectedProjectId),
    enabled: Boolean(selectedProjectId),
  })

  if (projectsQuery.isLoading || usersQuery.isLoading) {
    return <Skeleton className="h-[70vh] w-full" />
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="pt-6">
          <div className="w-full max-w-sm">
            <Select value={selectedProjectId} onValueChange={setProjectId} disabled={!projects.length}>
              <SelectTrigger>
                <SelectValue placeholder={projects.length ? "Choose project" : projectPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {projects.length ? (
                  projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="__no_project__" disabled>
                    {projectPlaceholder}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {projectQuery.isLoading ? (
        <Skeleton className="h-[70vh] w-full" />
      ) : projectQuery.data ? (
        <HierarchyCanvas
          kind="project"
          contextId={projectQuery.data.id}
          members={projectQuery.data.members ?? []}
          users={usersQuery.data ?? []}
          adapter={{
            addMember: projectsApi.addMember,
            updateMember: projectsApi.updateMember,
            deleteMember: projectsApi.deleteMember,
            upsertGraph: async (contextId, data) => {
              await projectsApi.upsertHierarchy({
                projectId: contextId,
                name: projectQuery.data.name,
                description: projectQuery.data.description ?? undefined,
                members: data.members,
              })
            },
          }}
          onReload={async () => {
            await projectQuery.refetch()
          }}
        />
      ) : null}
    </div>
  )
}
