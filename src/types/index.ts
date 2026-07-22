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
  /** Open role / new-hire slot on the org chart (cannot sign in). */
  isPlaceholder?: boolean
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
  isPlaceholder?: boolean
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
  assigneeId: string | null
  assigneeSpokenName: string | null
  sourceExcerpt: string | null
  description: string
  deadline: string | null
  done: boolean
  createdAt: string
  assignee: WorkUserRef | null
}

export type TaggingMappingTarget = "work_unit_owner" | "step"

export interface TaggingMapping {
  target: TaggingMappingTarget
  workUnitId: string
  stepId: string | null
  sourceExcerpt: string
  spokenName: string | null
  assigneeId: string | null
  assignee: WorkUserRef | null
}

export interface WorkAudioRecording {
  id: string
  transcript: string
  originalFilename?: string | null
  mimeType?: string | null
  fileSizeBytes?: number | null
  status?: string | null
  createdAt: string
}

export interface WorkUserRef {
  id: string
  name: string
  email: string
}

export interface WorkUnit {
  id: string
  userId: string
  createdById: string | null
  title: string
  context: string
  status: WorkUnitStatus
  isPrivate: boolean
  projectId: string | null
  project: { id: string; name: string; status: string } | null
  audioRecordingId: string | null
  assigneeSpokenName: string | null
  sourceExcerpt: string | null
  transcript?: string | null
  taggingMappings?: TaggingMapping[]
  audioRecording?: WorkAudioRecording | null
  closedAt: string | null
  nextDueAt: string | null
  firstDueAt: string | null
  createdAt: string
  updatedAt: string
  user: WorkUserRef
  createdBy: WorkUserRef | null
  steps: WorkStep[]
}

export interface AudioWorkResult {
  transcript: string
  audioRecording: {
    id: string
    userId: string
    source: string
    transcript: string
    originalFilename?: string | null
    languageCode: string | null
    createdAt: string
  }
  workUnits: WorkUnit[]
  taggingMappings?: TaggingMapping[]
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
  | "WORK_UNIT_ASSIGNED"
  | "WORK_STEP_ASSIGNED"
  | "WORK_STEP_OVERDUE"
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

export interface WorkAssignedNotificationData {
  workUnitId: string
  workUnitTitle?: string
  stepDescription?: string
  assignedByUser?: { id: string; name: string }
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

// ---------- Attendance / ETA tracker ----------

export type EtaStatus = "submitted" | "missing"
export type EtaRecordType = "office" | "wfh" | "leave" | "comp_off" | null
export type EtaBadge =
  | "on_time"
  | "late_submission"
  | "late_arrival"
  | "wfh"
  | "wfh_pending"
  | "wfh_approved"
  | "wfh_denied"
  | "leave"
  | "leave_pending"
  | "leave_approved"
  | "leave_denied"
  | "comp_off"
  | "office"
  | "missing"
  | "submitted"
export type EtaPod = "default" | "production"

export type EtaFilter =
  | "total"
  | "submitted"
  | "missing"
  | "office"
  | "wfh"
  | "leave"
  | "compOff"

export interface EtaSummary {
  total: number
  submitted: number
  missing: number
  wfh: number
  leave: number
  compOff: number
  office: number
}

export interface EtaEntry {
  id: number
  slackUserId: string
  userEmail: string
  userName: string
  entryDate: string
  etaText: string | null
  etaMinutes: number | null
  status: EtaStatus
  recordType: EtaRecordType
  submittedAt: string | null
  submittedOnTime: boolean | null
  isLateArrival: boolean | null
  rawMessage: string | null
  slackMessageTs: string | null
  reminderSentAt: string | null
  wfhApprovalState?: "pending" | "approved" | "denied" | null
  wfhApprovedAt?: string | null
  wfhApprovedBySlackUserId?: string | null
  wfhApprovalNote?: string | null
  leaveApprovalState?: "pending" | "approved" | "denied" | null
  leaveApprovedAt?: string | null
  leaveApprovedBySlackUserId?: string | null
  leaveApprovalNote?: string | null
  createdAt: string
  updatedAt: string
  badge: EtaBadge
  monthCounts?: EtaMonthCounts
}

export interface EtaMonthCounts {
  leave: number
  leaveApproved?: number
  leaveDenied?: number
  leavePending?: number
  leaveUnapproved?: number
  wfh: number
  wfhApproved?: number
  wfhDenied?: number
  wfhPending?: number
  wfhUnapproved?: number
  missing: number
}

export interface EtaListData {
  date: string
  summary: EtaSummary
  entries: EtaEntry[]
}

export interface EtaCheckResult {
  date: string
  weekend: boolean
  membersSynced: number
  history: { processed: number; recorded: number; errors: string[] }
  missingCreated: number
  reminders: { sent: number; skipped: number; errors: string[] }
}

export interface EtaRemindResult {
  sent: number
  skipped: number
  errors: string[]
}

export interface EtaMember {
  slackUserId: string
  name: string
  email: string
  realName: string
  pod: EtaPod
  syncedAt: string
}

export function canManageEta(user: User | null): boolean {
  return hasRole(user, "admin", "chief_of_staff")
}

export interface AttendancePolicyDoc {
  id: string
  bodyMd: string
  updatedAt: string
  updatedBy: { id: string; name: string } | null
}

export interface EtaApprovalBucket {
  total: number
  approved: number
  denied: number
  pending: number
  unapproved: number
}

export interface EtaPersonStatsCounts {
  wfh: number
  leave: number
  compOff: number
  office: number
  onTime: number
  lateSubmission: number
  lateArrival: number
  missing: number
  submitted: number
}

export interface EtaPersonStats {
  id: string
  slackUserId: string
  userId: string | null
  userEmail: string | null
  userName: string | null
  counts: EtaPersonStatsCounts
  action: {
    status: string
    note: string | null
    takenById: string | null
    takenBy: { id: string; name: string; email: string } | null
    takenAt: string | null
  }
  countsResetAt: string | null
  lastEntryDate: string | null
  lastComputedAt: string
  createdAt: string
  updatedAt: string
}

export interface EtaUserDetail {
  stats: EtaPersonStats
  breakdown: {
    wfh: EtaApprovalBucket
    leave: EtaApprovalBucket
    office: number
    onTime: number
    lateSubmission: number
    lateArrival: number
    missing: number
    submitted: number
    compOff: number
  }
  entries: EtaEntry[]
  groups: {
    wfh: {
      approved: EtaEntry[]
      denied: EtaEntry[]
      pending: EtaEntry[]
      unapproved: EtaEntry[]
    }
    leave: {
      approved: EtaEntry[]
      denied: EtaEntry[]
      pending: EtaEntry[]
      unapproved: EtaEntry[]
    }
    eta: EtaEntry[]
    missing: EtaEntry[]
    other: EtaEntry[]
  }
}

// ---------- Escalation tracker ----------

export type EscalationStatus = "open" | "in_progress" | "waiting" | "resolved" | "closed"
export type EscalationPriority = "low" | "medium" | "high" | "urgent"

export interface EscalationReporter {
  slackUserId: string | null
  name: string | null
  email: string | null
}

export interface EscalationAttachment {
  id: string
  name: string
  mimetype: string
  permalink: string | null
}

export interface EscalationAi {
  summary: string | null
  issueDescription: string | null
  blockers: string[]
  analyzedAt: string | null
}

export interface EscalationUpdate {
  id: string
  body: string
  authorName: string | null
  authorEmail: string | null
  slackUserId: string | null
  slackMessageTs: string
  inferredStatus: string | null
  isManual: boolean
  attachments?: EscalationAttachment[]
  createdAt: string
}

export interface EscalationItem {
  id: string
  title: string
  problemContext: string
  latestContext: string
  status: EscalationStatus
  priority: EscalationPriority
  reporter: EscalationReporter
  slack: { channelId: string; messageTs: string }
  latestUpdate: {
    body: string
    authorName: string | null
    inferredStatus: string | null
    at: string
  } | null
  latestUpdateAt: string | null
  resolvedAt: string | null
  attachments?: EscalationAttachment[]
  ai: EscalationAi
  createdAt: string
  updatedAt: string
  updates?: EscalationUpdate[]
}

export interface EscalationSummary {
  open: number
  inProgress: number
  waiting: number
  resolved: number
  closed: number
}

export interface EscalationListData {
  summary: EscalationSummary
  total: number
  items: EscalationItem[]
}

export interface EscalationSyncResult {
  processed: number
  escalations: number
  updates: number
  errors: string[]
}

export function canManageEscalations(user: User | null): boolean {
  return hasRole(user, "admin", "chief_of_staff")
}

// ---------- Google Meet / Meetings ----------

export type CalendarConnectionStatus = "CONNECTED" | "DISCONNECTED" | "ERROR"

export type MeetingStatus =
  | "SCHEDULED"
  | "JOINING"
  | "RECORDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"

export interface CalendarStatus {
  connected: boolean
  status?: CalendarConnectionStatus
  oauthEmail?: string
  connectedAt?: string
}

export interface MeetingVoiceRecording {
  id: string
  transcript: string | null
  status: string
}

export interface Meeting {
  id: string
  organizerUserId: string
  recallBotId: string | null
  calendarEventId: string | null
  meetingUrl: string
  title: string | null
  startTime: string | null
  status: MeetingStatus
  voiceRecordingId: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
  voiceRecording: MeetingVoiceRecording | null
}

export interface CalendarConnectResult {
  authorizationUrl: string
}

// ---------- Gmail ----------

export type GmailConnectionStatus = "CONNECTED" | "DISCONNECTED" | "ERROR"

export interface GmailStatus {
  connected: boolean
  status?: GmailConnectionStatus
  oauthEmail?: string
  connectedAt?: string
  lastSyncedAt?: string | null
  errorMessage?: string | null
}

export interface GmailConnectResult {
  authorizationUrl: string
}

export interface GmailMessage {
  id: string
  gmailMessageId: string
  threadId: string | null
  subject: string | null
  fromAddress: string | null
  toAddresses: string | null
  snippet: string | null
  bodyText: string | null
  labelIds: string[]
  receivedAt: string | null
  isRead: boolean
  createdAt: string
  updatedAt: string
}

export interface GmailSyncResult {
  synced: number
  messages: GmailMessage[]
}

// ---------- Brain map (Obsidian-style graph) ----------

export type BrainNodeType =
  | "member"
  | "meeting"
  | "work_unit"
  | "work_step"
  | "project"
  | "idea"
  | "theme"
  | "collaboration"
  | "escalation"

/** Common + AI/person edge kinds on the brain graph. */
export type BrainEdgeType =
  | "reported_by"
  | "updated_by"
  | "blocks"
  | "relates_to"
  | string

export interface BrainNodeMeta {
  color?: string
  entityId?: string
  status?: string
  priority?: string
  email?: string
  avatarUrl?: string
  designation?: string
  meetingUrl?: string
  startTime?: string | null
  hasTranscript?: boolean
  aiGenerated?: boolean
  /** Escalation AI summary text. */
  aiSummary?: string
  /** JSON string of string[], or occasionally a string[]. */
  aiBlockers?: string | string[]
  latestUpdateAt?: string | null
  resolvedAt?: string | null
  reporterName?: string | null
  reporterEmail?: string | null
  slackChannelId?: string
  slackMessageTs?: string
  [key: string]: unknown
}

export interface BrainNode {
  id: string
  type: BrainNodeType
  label: string
  val: number
  meta: BrainNodeMeta
}

export interface BrainEdge {
  id: string
  source: string
  target: string
  /** e.g. reported_by, updated_by, blocks, relates_to, … */
  type: BrainEdgeType
  weight?: number
  label?: string
}

export interface BrainGraphData {
  generatedAt: string
  cached: boolean
  nodes: BrainNode[]
  edges: BrainEdge[]
}

export interface BrainGraphParams {
  from?: string
  to?: string
  limitMeetings?: number
  includeSteps?: boolean
}
