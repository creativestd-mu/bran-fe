import { Navigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import type { RoleName } from "@/types"
import { hasPermission, hasRole } from "@/types"

interface ProtectedRouteProps {
  children: React.ReactNode
  roles?: RoleName[]
  permissions?: string[]
}

export function ProtectedRoute({ children, roles, permissions }: ProtectedRouteProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (roles && !hasRole(user, ...roles)) {
    return <Navigate to="/forbidden" replace />
  }

  if (permissions && !permissions.every((permission) => hasPermission(user, permission))) {
    return <Navigate to="/forbidden" replace />
  }

  return <>{children}</>
}
