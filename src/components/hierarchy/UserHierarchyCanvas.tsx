import { useQuery } from "@tanstack/react-query"
import { usersApi } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { HierarchyCanvas } from "./HierarchyCanvas"
import { usersToHierarchyMembers } from "./hierarchyUtils"

const ORG_CONTEXT_ID = "org"

export function UserHierarchyCanvas() {
  const usersQuery = useQuery({
    queryKey: ["users-palette"],
    queryFn: () => usersApi.listAll(),
  })

  const hierarchyQuery = useQuery({
    queryKey: ["users-hierarchy"],
    queryFn: () => usersApi.getHierarchy(),
  })

  if (usersQuery.isLoading || hierarchyQuery.isLoading) {
    return <Skeleton className="h-[70vh] w-full" />
  }

  if (hierarchyQuery.isError) {
    return (
      <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
        Failed to load org hierarchy.
      </div>
    )
  }

  const members = usersToHierarchyMembers(hierarchyQuery.data?.members ?? [], usersQuery.data ?? [])

  return (
    <HierarchyCanvas
      kind="user"
      contextId={ORG_CONTEXT_ID}
      members={members}
      users={usersQuery.data ?? []}
      allowRemove={false}
      onReload={async () => {
        await hierarchyQuery.refetch()
      }}
      adapter={{
        addMember: async () => {},
        updateMember: async () => {},
        deleteMember: async () => {},
        upsertGraph: async (_contextId, data) => {
          await usersApi.upsertHierarchy({
            members: data.members.map((member) => ({
              userId: member.userId,
              managerUserId: member.reportsToUserId,
            })),
          })
        },
      }}
    />
  )
}
