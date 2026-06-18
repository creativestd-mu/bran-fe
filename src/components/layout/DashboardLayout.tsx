import { useEffect, useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { TopBar } from "./TopBar"
import { CommandSearch } from "./CommandSearch"
import { Toaster } from "sonner"
import { useTheme } from "@/contexts/ThemeContext"
import { usePageVisitTracking } from "@/hooks/usePageVisitTracking"

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { theme } = useTheme()
  const location = useLocation()
  const isDashboardHome = location.pathname === "/dashboard"
  usePageVisitTracking()

  // Global ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return (
    <div className="flex min-h-screen bg-[var(--surface-gradient)]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} onSearchOpen={() => setSearchOpen(true)} />

        <main
          className={
            isDashboardHome
              ? "flex flex-1 flex-col overflow-x-clip overflow-y-auto"
              : "flex flex-1 flex-col overflow-hidden px-4 py-5 sm:px-6 lg:px-8 lg:py-7"
          }
        >
          {isDashboardHome ? (
            <Outlet />
          ) : (
            <div className="mx-auto flex h-full min-h-0 w-full max-w-[1440px] flex-col overflow-y-auto overflow-x-hidden rounded-[2rem] border border-border/55 bg-background/72 p-4 shadow-2xl shadow-black/10 backdrop-blur-xl sm:p-5 lg:p-6 dark:bg-background/62">
              <Outlet />
            </div>
          )}
        </main>
      </div>

      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

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
