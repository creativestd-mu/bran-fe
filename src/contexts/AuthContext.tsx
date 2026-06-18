import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { navigationApi, usersApi } from "@/lib/api"
import type { MostVisitedPage, User } from "@/types"

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  mostVisitedPages: MostVisitedPage[]
}

interface AuthContextType extends AuthState {
  login: (token: string, user: User, mostVisitedPages?: MostVisitedPage[]) => void
  logout: () => void
  refreshUser: () => Promise<void>
  setMostVisitedPages: React.Dispatch<React.SetStateAction<MostVisitedPage[]>>
}

const AuthContext = createContext<AuthContextType | null>(null)

const MOST_VISITED_KEY = "bran_most_visited"

function readStoredMostVisited(): MostVisitedPage[] {
  try {
    const raw = localStorage.getItem(MOST_VISITED_KEY)
    return raw ? (JSON.parse(raw) as MostVisitedPage[]) : []
  } catch {
    return []
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem("bran_token"),
    loading: true,
    mostVisitedPages: readStoredMostVisited(),
  })

  const setMostVisitedPages = useCallback((value: React.SetStateAction<MostVisitedPage[]>) => {
    setState((prev) => {
      const next = typeof value === "function" ? value(prev.mostVisitedPages) : value
      localStorage.setItem(MOST_VISITED_KEY, JSON.stringify(next))
      return { ...prev, mostVisitedPages: next }
    })
  }, [])

  const refreshUser = useCallback(async () => {
    const storedToken = localStorage.getItem("bran_token")
    if (!storedToken) {
      localStorage.removeItem(MOST_VISITED_KEY)
      setState({ user: null, token: null, loading: false, mostVisitedPages: [] })
      return
    }

    try {
      const [freshUser, pages] = await Promise.all([
        usersApi.me(),
        navigationApi.listPageVisits().catch(() => readStoredMostVisited()),
      ])
      localStorage.setItem("bran_user", JSON.stringify(freshUser))
      localStorage.setItem(MOST_VISITED_KEY, JSON.stringify(pages))
      setState({ user: freshUser, token: storedToken, loading: false, mostVisitedPages: pages })
    } catch {
      const tokenStillPresent = localStorage.getItem("bran_token")
      const cachedRaw = localStorage.getItem("bran_user")
      if (tokenStillPresent && cachedRaw) {
        setState({
          user: JSON.parse(cachedRaw) as User,
          token: tokenStillPresent,
          loading: false,
          mostVisitedPages: readStoredMostVisited(),
        })
      } else {
        localStorage.removeItem("bran_token")
        localStorage.removeItem("bran_user")
        localStorage.removeItem(MOST_VISITED_KEY)
        setState({ user: null, token: null, loading: false, mostVisitedPages: [] })
      }
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const login = useCallback((token: string, user: User, mostVisitedPages: MostVisitedPage[] = []) => {
    localStorage.setItem("bran_token", token)
    localStorage.setItem("bran_user", JSON.stringify(user))
    localStorage.setItem(MOST_VISITED_KEY, JSON.stringify(mostVisitedPages))
    setState({ user, token, loading: false, mostVisitedPages })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem("bran_token")
    localStorage.removeItem("bran_user")
    localStorage.removeItem(MOST_VISITED_KEY)
    setState({ user: null, token: null, loading: false, mostVisitedPages: [] })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshUser, setMostVisitedPages }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
