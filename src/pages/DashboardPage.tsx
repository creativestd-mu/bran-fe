import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { hasRole } from "@/types"
import type { Task, PaginatedResponse } from "@/types"
import { tasksApi, usersApi } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Users, CheckSquare, Clock, TrendingUp } from "lucide-react"

interface DashboardStats {
  totalUsers?: number
  totalTasksThisWeek: number
  completedTasks: number
  pendingTasks: number
}

export default function DashboardPage() {
  const { user } = useAuth()
  const isAdmin = hasRole(user, "admin", "manager")
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentTasks, setRecentTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const now = new Date()
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

        const tasksRes = await tasksApi.list({
          from: weekAgo.toISOString(),
          to: now.toISOString(),
          page: 1,
          pageSize: 50,
        })

        const tasks = tasksRes.items
        const completed = tasks.filter((t) => t.status === "COMPLETED").length
        const pending = tasks.filter((t) => t.status === "PENDING").length

        let totalUsers: number | undefined
        if (isAdmin) {
          try {
            const usersRes = await usersApi.list({ page: 1, pageSize: 1 })
            totalUsers = usersRes.pagination.total
          } catch { /* ignore */ }
        }

        setStats({ totalUsers, totalTasksThisWeek: tasks.length, completedTasks: completed, pendingTasks: pending })
        setRecentTasks(tasks.slice(0, 8))
      } catch {
        setStats({ totalTasksThisWeek: 0, completedTasks: 0, pendingTasks: 0 })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isAdmin])

  const statusVariant = (s: string) => {
    switch (s) {
      case "COMPLETED": return "success" as const
      case "PENDING": return "warning" as const
      case "IN_PROGRESS": return "info" as const
      case "CANCELLED": return "destructive" as const
      default: return "secondary" as const
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-brand text-2xl tracking-wide text-accent">
          {isAdmin ? "Command Center" : "My Dashboard"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome back, {user?.name?.split(" ")[0]}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isAdmin && stats?.totalUsers !== undefined && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
              <Users className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{stats.totalUsers}</div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tasks This Week</CardTitle>
            <TrendingUp className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">{stats?.totalTasksThisWeek}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            <CheckSquare className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">{stats?.completedTasks}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            <Clock className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">{stats?.pendingTasks}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-accent">Recent Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No tasks this week yet.</p>
          ) : (
            <div className="space-y-3">
              {recentTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{task.title}</p>
                    <div className="flex items-center gap-2">
                      {task.platform && (
                        <Badge variant="outline" className="text-[10px]">{task.platform}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {isAdmin ? task.user.name : ""} {task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : ""}
                      </span>
                    </div>
                  </div>
                  <Badge variant={statusVariant(task.status)} className="text-[10px]">
                    {task.status.replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
