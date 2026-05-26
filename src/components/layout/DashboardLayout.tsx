import { useState } from "react"
import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { TopBar } from "./TopBar"
import { Toaster } from "sonner"
import { useTheme } from "@/contexts/ThemeContext"

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { theme } = useTheme()

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      <Toaster
        theme={theme}
        toastOptions={{
          style: {
            background: "var(--card)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          },
        }}
      />
    </div>
  )
}
