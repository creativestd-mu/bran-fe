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
  roles?: Array<"admin" | "manager" | "content_creator">
  permissions?: string[]
}

const navItems: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "Users", path: "/users", icon: <Users className="h-4 w-4" />, roles: ["admin"] },
  { label: "Roles", path: "/roles", icon: <Shield className="h-4 w-4" />, roles: ["admin"] },
  { label: "Tasks", path: "/tasks", icon: <CheckSquare className="h-4 w-4" /> },
  { label: "Nodes", path: "/contents", icon: <FileVideo className="h-4 w-4" /> },
  { label: "Ideation", path: "/ideation", icon: <Lightbulb className="h-4 w-4" /> },
  { label: "AI Query", path: "/ai", icon: <Brain className="h-4 w-4" />, roles: ["admin", "manager"] },
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
      <div className="flex h-16 items-center justify-between border-b border-border px-6">
        <Link to="/dashboard" className="font-brand text-2xl tracking-wider text-accent" onClick={onClose}>
          BRan
        </Link>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-3">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + "/")
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/15 text-accent"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      <Separator />
      <div className="p-3">
        <button
          onClick={() => { logout(); navigate("/login"); onClose(); }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
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
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform duration-300 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {navContent}
      </aside>
    </>
  )
}
