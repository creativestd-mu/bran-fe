import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { usersApi } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { HierarchyCanvas } from "./HierarchyCanvas"
import { mergeHierarchyPaletteUsers, usersToHierarchyMembers } from "./hierarchyUtils"

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

  const paletteUsers = useMemo(
    () => mergeHierarchyPaletteUsers(usersQuery.data ?? [], hierarchyQuery.data?.members ?? []),
    [usersQuery.data, hierarchyQuery.data?.members]
  )

  const members = useMemo(
    () => usersToHierarchyMembers(hierarchyQuery.data?.members ?? [], paletteUsers),
    [hierarchyQuery.data?.members, paletteUsers]
  )

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

  return (
    <HierarchyCanvas
      kind="user"
      contextId={ORG_CONTEXT_ID}
      members={members}
      users={paletteUsers}
      allowRemove={false}
      onReload={async () => {
        await Promise.all([hierarchyQuery.refetch(), usersQuery.refetch()])
      }}
      adapter={{
        addMember: async () => {},
        updateMember: async () => {},
        deleteMember: async (memberId) => {
          try {
            const user = await usersApi.getById(memberId)
            if (user.isPlaceholder) {
              await usersApi.delete(memberId)
            }
          } catch {
            // Ignore missing/non-placeholder users removed from the canvas only.
          }
        },
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
