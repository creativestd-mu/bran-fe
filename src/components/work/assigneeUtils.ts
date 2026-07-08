import type { User } from "@/types"

export type WorkUserRef = { id: string; name: string; email: string }

export function sortUsersForAssigneePicker(users: User[], currentUserId: string | undefined) {
  const directReports = users.filter((user) => user.managerUserId === currentUserId && user.id !== currentUserId)
  const others = users.filter((user) => user.managerUserId !== currentUserId && user.id !== currentUserId)
  return [...directReports.sort((a, b) => a.name.localeCompare(b.name)), ...others.sort((a, b) => a.name.localeCompare(b.name))]
}

export function assigneeLabel(user: WorkUserRef | null | undefined, fallback = "Unassigned") {
  return user?.name ?? fallback
}
