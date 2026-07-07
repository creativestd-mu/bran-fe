export interface MostVisitedPage {
  path: string
  visitCount: number
  lastVisitedAt: string
}

export interface User {
  id: string
  googleId: string
  email: string
  name: string
  avatarUrl: string | null
  description: string | null
  phone: string | null
  designation: string | null
  roleId: string
  isActive: boolean
  managerUserId?: string | null
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
  role: { id: string; name: string }
  manager?: UserManagerRef | null
  directReports?: UserManagerRef[]
  permissions?: string[]
  socialAccounts?: SocialAccount[]
}

export interface UserManagerRef {
  id: string
  name: string
  email: string
  designation: string | null
}

export interface UserHierarchyMember {
  id: string
  name: string
  email: string
  designation: string | null
  managerUserId: string | null
  isActive: boolean
  role: { id: string; name: string }
  manager: UserManagerRef | null
  directReports?: UserHierarchyMember[]
}

export interface UserHierarchyResult {
  members: UserHierarchyMember[]
  hierarchy: UserHierarchyMember[]
}

export interface Role {
  id: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  permissions: Permission[]
  _count: { users: number }
}

export interface Permission {
  id: string
  name: string
  description: string | null
}

export type TaskType = "CONTENT_CREATION" | "TEAM_MANAGEMENT" | "GENERAL"
export type TaskPlatform = "YOUTUBE" | "INSTAGRAM" | "LINKEDIN" | "FACEBOOK"
export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"

export interface Task {
  id: string
  userId: string
  title: string
  description: string | null
  type: TaskType
  platform: TaskPlatform | null
  contentUrl: string | null
  status: TaskStatus
  metadata: string | null
  dueDate: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  user: { id: string; name: string; email: string }
}

export interface SocialAccount {
  id: string
  userId: string
  platform: TaskPlatform
  platformAccountId: string
  handle: string | null
  createdAt: string
}

export interface PaginatedResponse<T> {
  items: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNextPage: boolean
  }
}

export interface AdhocWorkEntry {
  id: string
  userId: string
  description: string
  output: string | null
  effortHours: number | null
  createdAt: string
  updatedAt: string
  user: { id: string; name: string; email: string }
}

export type WorkUnitStatus = "OPEN" | "CLOSED"

export interface WorkStep {
  id: string
  workUnitId: string
  description: string
  deadline: string | null
  done: boolean
  createdAt: string
}

export interface WorkUnit {
  id: string
  userId: string
  title: string
  context: string
  status: WorkUnitStatus
  isPrivate: boolean
  projectId: string | null
  project: { id: string; name: string; status: string } | null
  audioRecordingId: string | null
  closedAt: string | null
  nextDueAt: string | null
  firstDueAt: string | null
  createdAt: string
  updatedAt: string
  user: { id: string; name: string; email: string }
  steps: WorkStep[]
}

export interface AudioWorkResult {
  transcript: string
  audioRecording: {
    id: string
    userId: string
    filePath: string
    source: string
    createdAt: string
  }
  workUnits: WorkUnit[]
}

export interface DeadlineStep {
  id: string
  description: string
  deadline: string
  done: boolean
  workUnit: {
    id: string
    title: string
    status: WorkUnitStatus
    isPrivate: boolean
  }
}

export interface DeadlinesResult {
  date: string
  deadlines: DeadlineStep[]
}

export interface AIQueryMeta {
  user: { id: string; name: string }
  scope?: string
  timeRange: { from: string; to: string }
  taskCount: number
  adhocWorkCount?: number
  workUnitCount?: number
  visionCount?: number
  kpiCount?: number
  guidanceQuery?: boolean
  hadSemanticContext: boolean
  truncatedTasks?: boolean
  truncatedAdhocWork?: boolean
  truncatedWorkUnits?: boolean
  cached?: boolean
  queryId?: string
}

export interface AIQueryResponse {
  report: string
  meta: AIQueryMeta
}

export interface AIQueryHistoryItem {
  id: string
  query: string
  scope: string
  target: { id: string; name: string }
  timeRange: { from: string; to: string }
  report: string
  meta: AIQueryMeta
  cached: boolean
  expiresAt: string | null
  createdAt: string
}

export type VisionHorizon = "SHORT_TERM" | "LONG_TERM"
export type VisionScope = "ALL" | "SPECIFIC"

export interface VisionDocument {
  originalFilename: string
  mimeType: string
  fileSizeBytes: number
}

export interface VisionTeamRef {
  id: string
  name: string
  verticalId: string
  memberCount: number
}

export interface VisionInvolvement {
  scope: VisionScope
  teams: VisionTeamRef[]
  users: UserRef[]
}

export interface Vision {
  id: string
  title: string
  description: string | null
  horizon: VisionHorizon
  durationMonths: number
  startsAt: string
  endsAt: string
  scope: VisionScope
  document: VisionDocument
  involvement: VisionInvolvement
  createdBy: UserRef
  createdAt: string
  updatedAt: string
}

export interface KPI {
  id: string
  userId: string
  title: string
  description: string | null
  sortOrder: number
  isActive: boolean
  isKey: boolean
  user: UserRef
  createdBy: UserRef
  createdAt: string
  updatedAt: string
}

export interface SocialStats {
  platform: string
  accountId: string
  metrics: Record<string, number | string | null>
  fetchedAt: string
}

export interface SocialContent {
  platform: string
  accountId: string
  items: SocialContentItem[]
  fetchedAt: string
}

export interface SocialContentItem {
  id: string
  title?: string
  description?: string
  publishedAt?: string
  thumbnailUrl?: string
  metrics: Record<string, number | string | null>
}

export type MemberRole = "LEAD" | "MEMBER" | "CONTRIBUTOR"

export interface HierarchyMember {
  id: string
  userId: string
  memberRole: MemberRole
  isActive: boolean
  reportsToUserId: string | null
  user: User
}

export interface Team {
  id: string
  name: string
  description?: string | null
  verticalId?: string | null
  members: HierarchyMember[]
}

export interface ProjectPhase {
  id: string
  name: string
  objectives: string | null
  deadline: string | null
  status: string
  orderIndex: number
}

export interface Project {
  id: string
  name: string
  description?: string | null
  objectives?: string | null
  finalLink?: string | null
  verticalId?: string | null
  status?: string
  startsAt?: string | null
  endsAt?: string | null
  createdAt?: string
  updatedAt?: string
  vertical?: { id: string; name: string; slug: string }
  createdBy?: { id: string; name: string; email: string }
  phases?: ProjectPhase[]
  members: HierarchyMember[]
  hierarchy?: HierarchyMember[]
  _count?: { members: number }
}

export interface Vertical {
  id: string
  name: string
  slug: string
  description?: string | null
  ownerUserId?: string | null
  owner?: { id: string; name: string; email: string } | null
  createdAt: string
  updatedAt: string
  _count?: { teams: number; projects: number }
  teams: Team[]
  projects: Project[]
}

export interface HierarchyMemberPayload {
  userId: string
  memberRole: MemberRole
  reportsToUserId?: string | null
  isActive?: boolean
}

export type HierarchyKind = "team" | "project" | "user"

export type RoleName =
  | "admin"
  | "manager"
  | "content_creator"
  | "superadmin"
  | "chief_of_staff"

export function hasRole(user: User | null, ...roles: RoleName[]): boolean {
  if (!user) return false
  return roles.includes(user.role.name as RoleName)
}

// Roles that implicitly grant a permission when the user object doesn't
// expose a `permissions` array. This mirrors the server-side seeding so the
// UI can gate controls without an extra round-trip.
const PERMISSION_ROLE_FALLBACK: Record<string, RoleName[]> = {
  approve_rental_resources: ["superadmin", "admin", "chief_of_staff"],
  create_tasks: ["superadmin", "admin", "manager", "content_creator", "chief_of_staff"],
  query_ai: ["superadmin", "admin", "manager", "content_creator", "chief_of_staff"],
}

export function hasPermission(user: User | null, permission: string): boolean {
  if (!user) return false
  if (user.permissions?.includes(permission)) return true
  const fallbackRoles = PERMISSION_ROLE_FALLBACK[permission]
  if (fallbackRoles && fallbackRoles.some((r) => hasRole(user, r))) return true
  // Legacy default: admins are always allowed.
  return hasRole(user, "admin")
}

export function canManageVision(user: User | null): boolean {
  return hasRole(user, "admin", "chief_of_staff", "superadmin")
}

// ---------- Content module ----------

export type ContentType = "PRODUCTION" | "COVERAGE"
export type ContentStatus = "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "ARCHIVED"
export type NodeKind =
  | "SCRIPTING"
  | "SHOOT"
  | "EDITING"
  | "BRIEF"
  | "PUBLISHING"
  | "OTHER"
export type NodeStatus = "PENDING" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED"
export type TeamRole =
  | "SCRIPTER"
  | "DIRECTOR"
  | "DOP"
  | "AD"
  | "EDITOR"
  | "ACTOR"
  | "CREW"
  | "OTHER"
export type ApprovalState =
  | "PENDING"
  | "IN_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "REJECTED"

export interface UserRef {
  id: string
  name: string | null
  email: string | null
}

export interface ContentNodeOutput {
  id: string
  nodeId: string
  label: string
  url: string
  notes: string | null
  version: number
  approvalState: ApprovalState
  reviewNote: string | null
  submittedBy: UserRef | null
  reviewedBy: UserRef | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ContentNodeTeamMember {
  id: string
  nodeId: string
  userId: string
  role: TeamRole
  user: UserRef
  createdAt: string
}

export type ResourceSourceType = "IN_HOUSE" | "RENTAL"

export type ResourceApprovalState = "PENDING" | "APPROVED" | "REJECTED"

export interface ContentNodeResource {
  id: string
  nodeId: string
  name: string
  sourceType: ResourceSourceType
  cost: string | null
  quantity: number
  currency: string | null
  notes: string | null
  approvalState: ResourceApprovalState
  reviewNote: string | null
  requestedByUserId: string | null
  reviewedByUserId: string | null
  reviewedAt: string | null
  requestedBy: { id: string; name: string; email: string } | null
  reviewedBy: { id: string; name: string; email: string } | null
  createdAt: string
  updatedAt: string
}

export interface ContentNodeInputRef {
  fromNodeId: string
  fromNodeKind: NodeKind
  fromNodeName: string
  output: ContentNodeOutput
}

export interface ContentNode {
  id: string
  contentId: string
  kind: NodeKind
  name: string
  orderIndex: number
  status: NodeStatus
  notes: string | null
  startsAt: string | null
  dueDate: string | null
  completedAt: string | null
  team: ContentNodeTeamMember[]
  outputs: ContentNodeOutput[]
  resources: ContentNodeResource[]
  input: ContentNodeInputRef | null
  createdAt: string
  updatedAt: string
}

export interface ContentTeamRef {
  id: string
  name: string
  verticalId: string
}

export interface ContentVerticalRef {
  id: string
  name: string
  slug: string
  ownerUserId: string | null
}

export interface ContentProjectRef {
  id: string
  name: string
  verticalId: string
  status: string
  vertical: ContentVerticalRef
}

export interface Content {
  id: string
  title: string
  description: string | null
  type: ContentType
  status: ContentStatus
  createdBy: UserRef | null
  nodes: ContentNode[]
  teamId: string
  projectId: string
  team: ContentTeamRef
  project: ContentProjectRef
  createdAt: string
  updatedAt: string
}

// ---------- Notifications ----------

export type NotificationKind =
  | "CONTENT_NODE_READY"
  | "CONTENT_RESOURCE_REQUESTED"
  | "CONTENT_RESOURCE_REVIEWED"
  | (string & {})

export interface Notification {
  id: string
  userId: string
  kind: NotificationKind
  title: string
  body: string | null
  // The server stores `data` as a JSON-encoded string; parse before reading.
  data: string | null
  dedupeKey?: string | null
  readAt: string | null
  emailSentAt?: string | null
  createdAt: string
}

export interface NotificationsPage {
  items: Notification[]
  total: number
  unread: number
}

// ---------- Ideation ----------

export type CreateIdeaRequest = {
  title: string
  description: string
  tags?: string[]
}

export type IdeaItem = {
  id: string
  title: string
  description: string
  tags: string[]
  createdAt: string
  updatedAt?: string
}

export type RecommendationItem = {
  id: string
  score: number
  status: "SUGGESTED" | "NOTIFIED" | string
  createdAt: string
  sourceIdea: {
    id: string
    title: string
    description: string
    tags: string[]
    createdAt: string
  }
  matchedIdea: {
    id: string
    title: string
    description: string
    tags: string[]
    createdAt: string
  }
  matchedUser: {
    id: string
    name: string
    email: string
    designation: string | null
    avatarUrl: string | null
  }
}

export interface NodeReadyData {
  contentId: string
  contentTitle: string
  fromNode: { id: string; name: string; kind: NodeKind; orderIndex: number }
  toNode: { id: string; name: string; kind: NodeKind; orderIndex: number }
  approvedOutput: {
    id: string
    label: string
    url: string
    notes: string | null
    version: number
    reviewedAt: string | null
    approvalState: "APPROVED"
    reviewedBy: { id: string; name: string; email: string } | null
    submittedBy: { id: string; name: string; email: string } | null
  }
  link?: string
}

export function parseNotificationPayload<T = unknown>(n: Pick<Notification, "data">): T | null {
  if (!n.data) return null
  try {
    return JSON.parse(n.data) as T
  } catch {
    return null
  }
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export type InventoryStatus = "AVAILABLE" | "IN_USE" | "MAINTENANCE" | "RETIRED"
export type ReservationStatus = "ACTIVE" | "OVERDUE" | "RETURNED" | "CANCELLED"

export interface InventoryTeamAssignment {
  teamId: string
  isPrimary: boolean
  assignedAt: string
  team: {
    id: string
    name: string
    verticalId: string | null
    isActive: boolean
  }
}

export interface InventoryActiveReservation {
  id: string
  status: ReservationStatus
  reservedFrom: string
  dueBackAt: string
  node: {
    id: string
    name: string
    startsAt: string | null
    dueDate: string | null
    content: { id: string; title: string }
  }
}

export interface InventoryItem {
  id: string
  name: string
  description: string | null
  category: string | null
  serialNumber: string | null
  status: InventoryStatus
  isActive: boolean
  teams: InventoryTeamAssignment[]
  activeReservations: InventoryActiveReservation[]
  createdAt: string
  updatedAt: string
}

export interface InventoryReservation {
  id: string
  status: ReservationStatus
  reservedFrom: string
  dueBackAt: string
  returnedAt: string | null
  notes: string | null
  item: {
    id: string
    name: string
    category: string | null
    serialNumber: string | null
    status: InventoryStatus
  }
  node: {
    id: string
    name: string
    kind: string
    startsAt: string | null
    dueDate: string | null
    content: { id: string; title: string; teamId: string | null }
  }
  resource: { id: string; name: string } | null
  createdBy: { id: string; name: string; email: string } | null
  createdAt: string
  updatedAt: string
}

export interface InventoryPage {
  items: InventoryItem[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNextPage: boolean
  }
}

export interface ReservationPage {
  items: InventoryReservation[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNextPage: boolean
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export interface ResourceRequestedData {
  contentId: string
  contentTitle: string
  verticalName: string | null
  node: { id: string; name: string; kind: NodeKind; orderIndex: number }
  resource: {
    id: string
    name: string
    sourceType: ResourceSourceType
    cost: string | null
    currency: string | null
    quantity: number
    notes: string | null
  }
  requestedBy: { id: string; name: string; email: string } | null
  link?: string
}

export interface ResourceReviewedData {
  contentId: string
  contentTitle: string
  node: { id: string; name: string; kind: NodeKind; orderIndex: number }
  resource: {
    id: string
    name: string
    sourceType: ResourceSourceType
    cost: string | null
    currency: string | null
    quantity: number
    notes: string | null
    approvalState: ResourceApprovalState
    reviewNote: string | null
  }
  reviewedBy: { id: string; name: string; email: string } | null
  link?: string
}
