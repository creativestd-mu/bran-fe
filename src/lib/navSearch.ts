import type { ElementType } from "react"
import {
  LayoutDashboard,
  Users,
  Shield,
  CheckSquare,
  Brain,
  BarChart3,
  Share2,
  UserCircle,
  Settings,
  Network,
  UsersRound,
  FolderKanban,
  FileVideo,
  Wrench,
  Lightbulb,
  ClipboardList,
  Clock,
  TriangleAlert,
  Mic,
  Video,
  Mail,
  Orbit,
  Compass,
  Target,
  Package,
} from "lucide-react"
import { hasPermission, hasRole, type User } from "@/types"

export interface NavSearchItem {
  label: string
  path: string
  description: string
  icon: ElementType
  keywords: string[]
  roles?: Array<"admin" | "manager" | "content_creator" | "chief_of_staff" | "superadmin">
  permissions?: string[]
  /** Base priority added to the text-match score so high-value pages win ties.
   *  Higher number = shown earlier when multiple results match equally. */
  weight?: number
}

export const NAV_SEARCH_INDEX: NavSearchItem[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    description: "Home — search for any page",
    icon: LayoutDashboard,
    keywords: [
      "home", "overview", "summary", "stats", "metrics", "kpi", "command center",
      "recent", "deadlines", "week", "welcome", "landing", "main",
    ],
  },
  {
    label: "Tasks",
    path: "/tasks",
    description: "Kanban board of all content and team tasks",
    icon: CheckSquare,
    keywords: [
      "task", "to do", "todo", "to-do", "kanban", "board", "card",
      "pending", "in progress", "completed", "cancelled", "assign", "due",
      "youtube", "instagram", "linkedin", "facebook", "platform task",
      "content task", "team task", "general task", "create task", "new task",
    ],
  },
  {
    label: "Adhoc Work",
    path: "/adhoc-work",
    description: "Log off-platform work, coordination, hours",
    icon: ClipboardList,
    keywords: [
      "adhoc", "log work", "log hours", "off platform", "off-platform",
      "coordination", "deliverable", "effort", "hours",
      "manual work", "time entry", "extra work", "miscellaneous work",
      "field work", "track time", "time log",
    ],
  },
  {
    label: "Attendance",
    path: "/attendance",
    description: "Daily ETA tracker — office, WFH, leave, reminders",
    icon: Clock,
    roles: ["admin", "chief_of_staff"],
    keywords: [
      "attendance", "eta", "wfh", "work from home", "leave", "comp off",
      "compoff", "office", "missing", "reminder", "slack", "day off",
      "cs-day-off", "late", "on time", "check in", "pod", "production pod",
    ],
  },
  {
    label: "Escalations",
    path: "/escalations",
    description: "Slack escalation tracker — status, context, AI summary",
    icon: TriangleAlert,
    roles: ["admin", "chief_of_staff"],
    keywords: [
      "escalation", "escalations", "escalate", "slack", "blocker",
      "escalation-matrix", "urgent", "waiting", "customer issue", "incident",
      "status", "ai summary",
    ],
  },
  {
    label: "Work Units",
    path: "/work",
    description: "Meeting outcomes and follow-ups from voice memos",
    icon: Mic,
    weight: 10,
    keywords: [
      "work unit", "meeting", "follow up", "followup", "follow-up",
      "voice memo", "voice", "record", "recording", "audio", "transcribe",
      "transcript", "action item", "action point", "outcome", "memo",
      "minutes", "meeting notes", "generate", "ai generate",
    ],
  },
  {
    label: "Meetings",
    path: "/meetings",
    description: "Connect Google Calendar and send Bran Notetaker to Meet calls",
    icon: Video,
    weight: 9,
    keywords: [
      "meetings", "google meet", "meet", "calendar", "notetaker",
      "bran notetaker", "recall", "bot", "join meeting", "google calendar",
      "meeting bot", "auto join", "record meeting",
    ],
  },
  {
    label: "Gmail",
    path: "/gmail",
    description: "Connect Gmail and sync recent inbox messages into Bran",
    icon: Mail,
    weight: 9,
    keywords: [
      "gmail", "email", "inbox", "mail", "google mail", "sync email",
      "messages", "mailbox",
    ],
  },
  {
    label: "Brain map",
    path: "/brain",
    description: "Obsidian-style knowledge graph of people, meetings, and work",
    icon: Orbit,
    weight: 9,
    keywords: [
      "brain", "brain map", "graph", "obsidian", "knowledge graph",
      "network", "constellation", "map", "themes", "collaboration map",
    ],
  },
  {
    label: "Content",
    path: "/contents",
    description: "Productions and coverage pieces with workflow nodes including shoots",
    icon: FileVideo,
    keywords: [
      "content", "production", "coverage", "piece", "video", "article",
      "workflow", "node", "publish", "draft", "in review", "published",
      "rental", "output", "resource", "review", "content piece", "new content",
      "shoot", "shoots", "shoot day", "shoot node", "film", "filming", "on set",
    ],
  },
  {
    label: "Ideation",
    path: "/ideation",
    description: "Capture ideas and discover teammates with similar concepts",
    icon: Lightbulb,
    keywords: [
      "idea", "ideation", "brainstorm", "brainstorming", "concept", "pitch",
      "creative", "thought", "suggestion", "tag", "match", "collaborate",
      "similarity", "collaborate", "innovation", "spark",
    ],
  },
  {
    label: "Vision",
    path: "/visions",
    description: "Org direction documents — short and long-term strategy",
    icon: Compass,
    keywords: [
      "vision", "strategy", "roadmap", "direction", "goals", "long term",
      "short term", "org direction", "team vision", "plan", "document",
      "upload vision", "focus area", "quarterly plan", "annual plan",
    ],
  },
  {
    label: "KPIs",
    path: "/kpis",
    description: "Per-person expected outcomes aligned with vision",
    icon: Target,
    keywords: [
      "kpi", "key performance", "expected outcome", "target", "goal",
      "deliverable", "metrics", "objective", "personal goal", "focus",
      "performance target", "outcome", "sort order",
    ],
  },
  {
    label: "AI Query",
    path: "/ai",
    description: "Performance reports and vision-aligned focus guidance",
    icon: Brain,
    keywords: [
      "ai", "ask ai", "artificial intelligence", "query", "report",
      "performance report", "team report", "insight", "analysis",
      "natural language", "question", "weekly report", "monthly report",
      "what did the team do", "how is the team", "intelligence", "llm",
      "chat", "assistant", "generate report", "what should i focus on",
      "focus", "priority", "goals", "strategy", "roadmap", "direction",
      "salary", "career", "what more should i do", "vision alignment",
      "guidance", "what should i do",
    ],
    permissions: ["query_ai"],
  },
  {
    label: "Social Stats",
    path: "/social-stats",
    description: "Your YouTube and Instagram analytics",
    icon: BarChart3,
    keywords: [
      "social stats", "youtube", "instagram", "subscriber", "views",
      "followers", "channel", "analytics", "social analytics", "performance",
      "social media stats", "video stats", "reel stats", "likes", "comments",
      "my channel", "my stats",
    ],
    roles: ["admin", "manager"],
  },
  {
    label: "Social Insights",
    path: "/social-insights",
    description: "Meltwater social listening across Instagram, LinkedIn, Facebook",
    icon: Share2,
    keywords: [
      "social insight", "meltwater", "mention", "sentiment", "listening",
      "linkedin", "facebook", "instagram", "reach", "engagement", "sync",
      "record", "aggregate", "social data", "positive", "negative",
      "brand mention", "media monitoring",
    ],
  },
  {
    label: "Teams",
    path: "/teams",
    description: "Manage teams across verticals",
    icon: UsersRound,
    keywords: [
      "team", "squad", "group", "department", "vertical", "create team",
      "manage team", "team member", "who is in", "team list",
    ],
    roles: ["admin", "manager"],
  },
  {
    label: "Projects",
    path: "/projects",
    description: "Manage projects across verticals",
    icon: FolderKanban,
    keywords: [
      "project", "campaign", "initiative", "vertical", "create project",
      "manage project", "project list", "brand campaign", "q3", "milestone",
    ],
    roles: ["admin", "manager"],
  },
  {
    label: "Hierarchy",
    path: "/hierarchy",
    description: "Build reporting lines for teams and projects",
    icon: Network,
    keywords: [
      "hierarchy", "org chart", "organogram", "reporting line", "structure",
      "parent", "child", "team tree", "graph", "reporting", "who reports to",
      "chain of command", "org structure",
    ],
    roles: ["admin", "manager"],
  },
  {
    label: "Users",
    path: "/users",
    description: "Manage team members and their roles",
    icon: Users,
    keywords: [
      "user", "people", "person", "member", "staff", "employee", "account",
      "add user", "invite", "team member", "manage users", "user list",
      "deactivate", "activate", "last login",
    ],
    roles: ["admin"],
  },
  {
    label: "Roles & Permissions",
    path: "/roles",
    description: "Access control — create roles and assign permissions",
    icon: Shield,
    keywords: [
      "role", "permission", "access", "access control", "rbac", "admin",
      "manager", "content creator", "grant", "revoke", "privilege",
      "who can do", "restrict", "allow",
    ],
    roles: ["admin"],
  },
  {
    label: "Profile",
    path: "/profile",
    description: "Edit your personal info and linked social accounts",
    icon: UserCircle,
    keywords: [
      "profile", "my account", "my profile", "personal", "avatar", "phone",
      "designation", "social account", "link account", "update name",
      "edit profile", "account settings",
    ],
  },
  {
    label: "Settings",
    path: "/settings",
    description: "Application-level configuration",
    icon: Settings,
    keywords: [
      "settings", "configuration", "config", "app settings", "system",
      "setup", "admin settings", "preferences",
    ],
    roles: ["admin"],
  },
  {
    label: "Inventory",
    path: "/inventory",
    description: "Equipment catalog — cameras, mics, lights, gear and reservations",
    icon: Package,
    keywords: [
      "inventory", "equipment", "gear", "camera", "mic", "microphone", "light", "lighting",
      "lens", "tripod", "stabilizer", "monitor", "storage card", "battery", "power",
      "catalog", "kit", "available", "in use", "maintenance", "retired",
      "reservation", "reserved", "overdue", "return", "returned", "check out",
      "serial number", "team ownership", "borrow", "asset",
    ],
  },
  {
    label: "Utility",
    path: "/utility",
    description: "Internal tools and helpers",
    icon: Wrench,
    keywords: [
      "utility", "tools", "helper", "miscellaneous", "debug", "internal",
    ],
  },
]

function scoreNavSearchItem(query: string, item: NavSearchItem): number {
  const q = query.toLowerCase().trim()
  if (!q) return 0

  const tokens = q.split(/\s+/).filter((t) => t.length >= 2)
  const haystackPhrases = [
    item.label.toLowerCase(),
    item.description.toLowerCase(),
    ...item.keywords.map((k) => k.toLowerCase()),
  ]

  let s = item.weight ?? 0

  for (const h of haystackPhrases) {
    if (h === q) s += 40
    else if (h.startsWith(q)) s += 20
    else if (h.includes(q)) s += 12
  }

  for (const token of tokens) {
    for (const h of haystackPhrases) {
      if (h === token) s += 8
      else if (h.startsWith(token)) s += 5
      else if (h.includes(token)) s += 3
    }
  }

  return s
}

export function getVisibleNavSearchItems(user: User | null): NavSearchItem[] {
  return NAV_SEARCH_INDEX.filter((item) => {
    if (item.roles && !item.roles.some((r) => hasRole(user, r))) return false
    if (item.permissions && !item.permissions.every((p) => hasPermission(user, p))) return false
    return true
  })
}

export function getNavItemByPath(path: string): NavSearchItem | undefined {
  const exact = NAV_SEARCH_INDEX.find((item) => item.path === path)
  if (exact) return exact

  return NAV_SEARCH_INDEX.filter(
    (item) => item.path !== "/dashboard" && path.startsWith(`${item.path}/`)
  ).sort((a, b) => b.path.length - a.path.length)[0]
}

export function getNavSearchResults(user: User | null, query: string): NavSearchItem[] {
  const visibleItems = getVisibleNavSearchItems(user)
  const trimmed = query.trim()

  if (!trimmed) return visibleItems

  return visibleItems
    .map((item) => ({ item, score: scoreNavSearchItem(trimmed, item) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
}
