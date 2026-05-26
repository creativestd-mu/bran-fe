import type {
  ApprovalState,
  ContentStatus,
  ContentType,
  NodeKind,
  NodeStatus,
  TeamRole,
} from "@/types"

export const CONTENT_TYPES: ContentType[] = ["PRODUCTION", "COVERAGE"]

export const CONTENT_STATUSES: ContentStatus[] = [
  "DRAFT",
  "IN_PROGRESS",
  "COMPLETED",
  "ARCHIVED",
]

export const NODE_KINDS: NodeKind[] = [
  "SCRIPTING",
  "SHOOT",
  "EDITING",
  "BRIEF",
  "PUBLISHING",
  "OTHER",
]

export const NODE_STATUSES: NodeStatus[] = [
  "PENDING",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETED",
]

export const TEAM_ROLES: TeamRole[] = [
  "SCRIPTER",
  "DIRECTOR",
  "DOP",
  "AD",
  "EDITOR",
  "ACTOR",
  "CREW",
  "OTHER",
]

export const APPROVAL_STATES: ApprovalState[] = [
  "PENDING",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REJECTED",
]

// Server-enforced state machine for approvals.
export const APPROVAL_TRANSITIONS: Record<ApprovalState, ApprovalState[]> = {
  PENDING: ["IN_REVIEW", "APPROVED", "REJECTED"],
  IN_REVIEW: ["CHANGES_REQUESTED", "APPROVED", "REJECTED"],
  CHANGES_REQUESTED: ["IN_REVIEW", "APPROVED", "REJECTED"],
  APPROVED: ["REJECTED", "IN_REVIEW"],
  REJECTED: ["IN_REVIEW"],
}

export function pretty(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "destructive"
  | "success"
  | "warning"
  | "info"

export const CONTENT_STATUS_BADGE: Record<ContentStatus, BadgeVariant> = {
  DRAFT: "outline",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  ARCHIVED: "secondary",
}

export const NODE_STATUS_BADGE: Record<NodeStatus, BadgeVariant> = {
  PENDING: "outline",
  IN_PROGRESS: "info",
  BLOCKED: "destructive",
  COMPLETED: "success",
}

export const APPROVAL_BADGE: Record<ApprovalState, BadgeVariant> = {
  PENDING: "outline",
  IN_REVIEW: "info",
  CHANGES_REQUESTED: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
}

export const CONTENT_TYPE_BADGE: Record<ContentType, BadgeVariant> = {
  PRODUCTION: "default",
  COVERAGE: "secondary",
}

// Suggested production preset – wired in CreateContentDialog.
export const PRODUCTION_PRESET: Array<{ kind: NodeKind; name: string }> = [
  { kind: "SCRIPTING", name: "Scripting" },
  { kind: "SHOOT", name: "Shoot" },
  { kind: "EDITING", name: "Editing" },
]
