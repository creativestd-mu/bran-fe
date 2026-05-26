import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { teamsApi, usersApi } from "@/lib/api"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { HierarchyCanvas } from "./HierarchyCanvas"

export function TeamHierarchyCanvas() {
  const [teamId, setTeamId] = useState<string>("")

  const teamsQuery = useQuery({
    queryKey: ["teams-list"],
    queryFn: teamsApi.list,
  })

  const usersQuery = useQuery({
    queryKey: ["users-palette"],
    queryFn: async () => (await usersApi.list({ page: 1, pageSize: 200 })).items,
  })

  const teams = teamsQuery.data ?? []
  const selectedTeamId = teamId || teams[0]?.id || ""
  const teamPlaceholder = teamsQuery.isError ? "Unable to load teams" : "No teams available"

  const teamQuery = useQuery({
    queryKey: ["team-details", selectedTeamId],
    queryFn: () => teamsApi.getById(selectedTeamId),
    enabled: Boolean(selectedTeamId),
  })

  if (teamsQuery.isLoading || usersQuery.isLoading) {
    return <Skeleton className="h-[70vh] w-full" />
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="pt-6">
          <div className="w-full max-w-sm">
            <Select value={selectedTeamId} onValueChange={setTeamId} disabled={!teams.length}>
              <SelectTrigger>
                <SelectValue placeholder={teams.length ? "Choose team" : teamPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {teams.length ? (
                  teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="__no_team__" disabled>
                    {teamPlaceholder}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {teamQuery.isLoading ? (
        <Skeleton className="h-[70vh] w-full" />
      ) : teamQuery.data ? (
        <HierarchyCanvas
          kind="team"
          contextId={teamQuery.data.id}
          members={teamQuery.data.members ?? []}
          users={usersQuery.data ?? []}
          adapter={{
            addMember: teamsApi.addMember,
            updateMember: teamsApi.updateMember,
            deleteMember: teamsApi.deleteMember,
            upsertGraph: async (contextId, data) => {
              await teamsApi.upsertHierarchy({
                teamId: contextId,
                name: teamQuery.data.name,
                description: teamQuery.data.description ?? undefined,
                members: data.members,
              })
            },
          }}
          onReload={async () => {
            await teamQuery.refetch()
          }}
        />
      ) : null}
    </div>
  )
}
