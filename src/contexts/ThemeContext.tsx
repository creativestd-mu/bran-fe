import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"

export type Theme = "light" | "dark"
export type ThemePreference = Theme | "system"

interface ThemeContextType {
  theme: Theme
  preference: ThemePreference
  setTheme: (theme: Theme) => void
  setPreference: (preference: ThemePreference) => void
  toggleTheme: () => void
}

/** v2 key — old `bran_theme` always defaulted to dark and overwrote itself on load. */
const STORAGE_KEY = "bran_theme_preference"
const LEGACY_STORAGE_KEY = "bran_theme"
const ThemeContext = createContext<ThemeContextType | null>(null)

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "dark"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system"
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === "light" || stored === "dark" || stored === "system") return stored
    // Drop the legacy auto-written dark/light default so the device theme wins.
    window.localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // ignore
  }
  return "system"
}

function resolveTheme(preference: ThemePreference): Theme {
  if (preference === "light" || preference === "dark") return preference
  return getSystemTheme()
}

function applyThemeClass(theme: Theme) {
  const root = document.documentElement
  if (theme === "dark") root.classList.add("dark")
  else root.classList.remove("dark")
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStoredPreference())
  const [theme, setThemeState] = useState<Theme>(() => resolveTheme(readStoredPreference()))

  useEffect(() => {
    const next = resolveTheme(preference)
    setThemeState(next)
    applyThemeClass(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, preference)
      window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {
      // ignore storage failures (private mode, etc.)
    }
  }, [preference])

  useEffect(() => {
    if (preference !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => {
      const next = getSystemTheme()
      setThemeState(next)
      applyThemeClass(next)
    }
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [preference])

  const setTheme = useCallback((next: Theme) => setPreferenceState(next), [])
  const setPreference = useCallback((next: ThemePreference) => setPreferenceState(next), [])
  const toggleTheme = useCallback(
    () =>
      setPreferenceState((prev) => {
        const current = resolveTheme(prev)
        return current === "dark" ? "light" : "dark"
      }),
    []
  )

  return (
    <ThemeContext.Provider value={{ theme, preference, setTheme, setPreference, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}
