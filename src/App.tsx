import { Navigate, Route, Routes } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { useAutoHideScrollbars } from "@/hooks/useAutoHideScrollbars"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { GlobalApiLoader } from "@/components/layout/GlobalApiLoader"
import LoginPage from "@/pages/LoginPage"
import DashboardPage from "@/pages/DashboardPage"
import UsersPage from "@/pages/UsersPage"
import UserDetailPage from "@/pages/UserDetailPage"
import RolesPage from "@/pages/RolesPage"
import TasksPage from "@/pages/TasksPage"
import AIQueryPage from "@/pages/AIQueryPage"
import SocialStatsPage from "@/pages/SocialStatsPage"
import SocialInsightsPage from "@/pages/SocialInsightsPage"
import ProfilePage from "@/pages/ProfilePage"
import SettingsPage from "@/pages/SettingsPage"
import ForbiddenPage from "@/pages/ForbiddenPage"
import HierarchyPage from "@/pages/HierarchyPage"
import TeamsPage from "@/pages/TeamsPage"
import ProjectsPage from "@/pages/ProjectsPage"
import TeamDetailPage from "@/pages/TeamDetailPage"
import ProjectDetailPage from "@/pages/ProjectDetailPage"
import ContentsPage from "@/pages/ContentsPage"
import ContentDetailPage from "@/pages/ContentDetailPage"
import UtilityPage from "@/pages/UtilityPage"
import IdeationPage from "@/pages/IdeationPage"
import AdhocWorkPage from "@/pages/AdhocWorkPage"
import WorkUnitsPage from "@/pages/WorkUnitsPage"
import VisionsPage from "@/pages/VisionsPage"
import KPIsPage from "@/pages/KPIsPage"
import InventoryPage from "@/pages/InventoryPage"
import AttendancePage from "@/pages/AttendancePage"
import AttendancePoliciesPage from "@/pages/AttendancePoliciesPage"
import EscalationsPage from "@/pages/EscalationsPage"
import MeetingsPage from "@/pages/MeetingsPage"
import BrainMapPage from "@/pages/BrainMapPage"

function App() {
  const { user, loading } = useAuth()
  useAutoHideScrollbars()

  if (loading) {
    return (
      <>
        <GlobalApiLoader />
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="space-y-4 text-center">
            <h1 className="font-brand text-3xl tracking-wider text-accent">BRan</h1>
            <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <GlobalApiLoader />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/forbidden" element={<ForbiddenPage />} />

      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route
          path="/users"
          element={
            <ProtectedRoute roles={["admin"]}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/:id"
          element={
            <ProtectedRoute roles={["admin"]}>
              <UserDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/roles"
          element={
            <ProtectedRoute roles={["admin"]}>
              <RolesPage />
            </ProtectedRoute>
          }
        />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/adhoc-work" element={<AdhocWorkPage />} />
        <Route
          path="/attendance"
          element={
            <ProtectedRoute roles={["admin", "chief_of_staff"]}>
              <AttendancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/attendance/policies"
          element={
            <ProtectedRoute roles={["admin", "chief_of_staff"]}>
              <AttendancePoliciesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/escalations"
          element={
            <ProtectedRoute roles={["admin", "chief_of_staff"]}>
              <EscalationsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/work" element={<WorkUnitsPage />} />
        <Route path="/meetings" element={<MeetingsPage />} />
        <Route path="/brain" element={<BrainMapPage />} />
        <Route path="/visions" element={<VisionsPage />} />
        <Route path="/kpis" element={<KPIsPage />} />
        <Route
          path="/ai"
          element={
            <ProtectedRoute permissions={["query_ai"]}>
              <AIQueryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/social-stats"
          element={
            <ProtectedRoute roles={["admin", "manager"]}>
              <SocialStatsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/social-insights" element={<SocialInsightsPage />} />
        <Route
          path="/hierarchy"
          element={
            <ProtectedRoute roles={["admin", "manager"]}>
              <HierarchyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teams"
          element={
            <ProtectedRoute roles={["admin", "manager"]}>
              <TeamsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teams/:id"
          element={
            <ProtectedRoute roles={["admin", "manager"]}>
              <TeamDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects"
          element={
            <ProtectedRoute roles={["admin", "manager"]}>
              <ProjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <ProtectedRoute roles={["admin", "manager"]}>
              <ProjectDetailPage />
            </ProtectedRoute>
          }
        />
        <Route path="/contents" element={<ContentsPage />} />
        <Route path="/contents/:id" element={<ContentDetailPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route
          path="/ideation"
          element={<IdeationPage />}
        />
        <Route path="/utility" element={<UtilityPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route
          path="/settings"
          element={
            <ProtectedRoute roles={["admin"]}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
      </Route>

        <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </>
  )
}

export default App
