import { Link, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { hasPermission, hasRole } from "@/types"
import { cn } from "@/lib/utils"
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
  X,
  LogOut,
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
  Orbit,
  Compass,
  Target,
  Package,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

interface SidebarProps {
  open: boolean
  onClose: () => void
}

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  roles?: Array<"admin" | "manager" | "content_creator" | "chief_of_staff" | "superadmin">
  permissions?: string[]
}

const navItems: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "Users", path: "/users", icon: <Users className="h-4 w-4" />, roles: ["admin"] },
  { label: "Roles", path: "/roles", icon: <Shield className="h-4 w-4" />, roles: ["admin"] },
  { label: "Tasks", path: "/tasks", icon: <CheckSquare className="h-4 w-4" /> },
  { label: "Adhoc Work", path: "/adhoc-work", icon: <ClipboardList className="h-4 w-4" /> },
  { label: "Attendance", path: "/attendance", icon: <Clock className="h-4 w-4" />, roles: ["admin", "chief_of_staff"] },
  { label: "Escalations", path: "/escalations", icon: <TriangleAlert className="h-4 w-4" />, roles: ["admin", "chief_of_staff"] },
  { label: "Work Units", path: "/work", icon: <Mic className="h-4 w-4" /> },
  { label: "Meetings", path: "/meetings", icon: <Video className="h-4 w-4" /> },
  { label: "Brain map", path: "/brain", icon: <Orbit className="h-4 w-4" /> },
  { label: "Nodes", path: "/contents", icon: <FileVideo className="h-4 w-4" /> },
  { label: "Inventory", path: "/inventory", icon: <Package className="h-4 w-4" /> },
  { label: "Ideation", path: "/ideation", icon: <Lightbulb className="h-4 w-4" /> },
  { label: "Vision", path: "/visions", icon: <Compass className="h-4 w-4" /> },
  { label: "KPIs", path: "/kpis", icon: <Target className="h-4 w-4" /> },
  { label: "AI Query", path: "/ai", icon: <Brain className="h-4 w-4" />, permissions: ["query_ai"] },
  { label: "Social Stats", path: "/social-stats", icon: <BarChart3 className="h-4 w-4" />, roles: ["admin", "manager"] },
  { label: "Social Insights", path: "/social-insights", icon: <Share2 className="h-4 w-4" /> },
  { label: "Teams", path: "/teams", icon: <UsersRound className="h-4 w-4" />, roles: ["admin", "manager"] },
  { label: "Projects", path: "/projects", icon: <FolderKanban className="h-4 w-4" />, roles: ["admin", "manager"] },
  { label: "Hierarchy", path: "/hierarchy", icon: <Network className="h-4 w-4" />, roles: ["admin", "manager"] },
  { label: "Utility", path: "/utility", icon: <Wrench className="h-4 w-4" /> },
  { label: "Profile", path: "/profile", icon: <UserCircle className="h-4 w-4" /> },
  { label: "Settings", path: "/settings", icon: <Settings className="h-4 w-4" />, roles: ["admin"] },
]

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const visibleItems = navItems.filter((item) => {
    if (item.roles && !item.roles.some((role) => hasRole(user, role))) return false
    if (item.permissions && !item.permissions.every((permission) => hasPermission(user, permission))) return false
    return true
  })

  const navContent = (
    <>
      <div className="flex h-20 items-center justify-between border-b border-border/50 px-5">
        <Link to="/dashboard" className="group flex items-center gap-3" onClick={onClose}>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-lg shadow-primary/20">
            B
          </span>
          <span className="font-brand text-2xl tracking-wider text-[var(--sidebar-foreground)]">
            BRan
          </span>
        </Link>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <ScrollArea className="flex-1 py-5">
        <nav className="space-y-1.5 px-3">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + "/")
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-xl transition-colors",
                    isActive ? "bg-primary-foreground/18" : "bg-muted/55 group-hover:bg-background/80"
                  )}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      <Separator className="bg-border/60" />
      <div className="p-3">
        <button
          onClick={() => { logout(); navigate("/login"); onClose(); }}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </>
  )

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col border-r border-border/50 bg-[var(--sidebar)] shadow-2xl backdrop-blur-xl transition-transform duration-300",
          "lg:static lg:z-auto lg:translate-x-0 lg:shadow-none",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {navContent}
      </aside>
    </>
  )
}
