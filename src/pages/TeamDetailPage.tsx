import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useParams } from "react-router-dom"
import { ChevronLeft, Users } from "lucide-react"
import { teamsApi, usersApi } from "@/lib/api"
import { HierarchyCanvas } from "@/components/hierarchy/HierarchyCanvas"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

export default function TeamDetailPage() {
  const { id = "" } = useParams<{ id: string }>()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [savingDetails, setSavingDetails] = useState(false)

  const teamQuery = useQuery({
    queryKey: ["team-details-page", id],
    queryFn: () => teamsApi.getById(id),
    enabled: Boolean(id),
  })

  const usersQuery = useQuery({
    queryKey: ["users-palette-team-detail"],
    queryFn: async () => (await usersApi.list({ page: 1, pageSize: 200 })).items,
  })

  useEffect(() => {
    if (!teamQuery.data) return
    setName(teamQuery.data.name)
    setDescription(teamQuery.data.description ?? "")
  }, [teamQuery.data])

  if (!id) {
    return <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">Invalid team id.</div>
  }

  if (teamQuery.isLoading || usersQuery.isLoading) {
    return <Skeleton className="h-[74vh] w-full" />
  }

  if (!teamQuery.data) {
    return <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">Team not found.</div>
  }

  const team = teamQuery.data
  const detailsChanged = name.trim() !== team.name || (description.trim() || "") !== (team.description ?? "")

  const saveDetails = async () => {
    const nextName = name.trim()
    if (!nextName) {
      toast.error("Team name is required")
      return
    }

    setSavingDetails(true)
    try {
      await teamsApi.update(team.id, {
        name: nextName,
        description: description.trim() || undefined,
      })
      toast.success("Team details updated")
      await teamQuery.refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update team")
    } finally {
      setSavingDetails(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link to="/teams">
            <ChevronLeft className="h-4 w-4" /> Back to teams
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="font-brand text-2xl tracking-wide text-accent">Team Details</h1>
              <Badge variant="outline" className="gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {team.members?.length ?? 0} members
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="team-name">Title</Label>
                  <Input id="team-name" value={name} onChange={(event) => setName(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team-description">Description</Label>
                  <Textarea
                    id="team-description"
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
                    setName(team.name)
                    setDescription(team.description ?? "")
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
        kind="team"
        contextId={team.id}
        members={team.members ?? []}
        users={usersQuery.data ?? []}
        adapter={{
          addMember: teamsApi.addMember,
          updateMember: teamsApi.updateMember,
          deleteMember: teamsApi.deleteMember,
          upsertGraph: async (contextId, data) => {
            await teamsApi.upsertHierarchy({
              teamId: contextId,
              name: team.name,
              description: team.description ?? undefined,
              members: data.members,
            })
          },
        }}
        onReload={async () => {
          await teamQuery.refetch()
        }}
      />
    </div>
  )
}
