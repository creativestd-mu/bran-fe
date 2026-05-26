import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, Menu, User, Moon, Sun } from "lucide-react"
import { useTheme } from "@/contexts/ThemeContext"
import { NotificationsMenu } from "@/components/layout/NotificationsMenu"

interface TopBarProps {
  onMenuClick: () => void
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?"

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center gap-4 px-4 lg:px-6">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>

        <Link to="/" className="font-brand text-xl tracking-wider text-accent lg:hidden">
          BRan
        </Link>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="icon"
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          onClick={toggleTheme}
          className="rounded-full border border-border text-foreground hover:bg-secondary hover:text-accent"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <NotificationsMenu />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 rounded-full border border-primary/60 bg-primary/10 px-2 text-foreground hover:bg-primary/20"
            >
              <Avatar className="h-8 w-8 border-2 border-primary">
                <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.name ?? ""} />
                <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden items-start gap-1 md:flex md:flex-col">
                <span className="text-sm font-medium leading-none">{user?.name}</span>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {user?.role.name.replace("_", " ")}
                </Badge>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/profile")}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { logout(); navigate("/login"); }}>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
