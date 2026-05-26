import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { usersApi } from "@/lib/api"
import type { User } from "@/types"

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
}

interface AuthContextType extends AuthState {
  login: (token: string, user: User) => void
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem("bran_token"),
    loading: true,
  })

  const refreshUser = useCallback(async () => {
    const storedToken = localStorage.getItem("bran_token")
    if (!storedToken) {
      setState({ user: null, token: null, loading: false })
      return
    }

    try {
      const freshUser = await usersApi.me()
      localStorage.setItem("bran_user", JSON.stringify(freshUser))
      setState({ user: freshUser, token: storedToken, loading: false })
    } catch {
      // If the 401 interceptor already cleared the token, don't use
      // stale cached data — force a clean logout state.
      const tokenStillPresent = localStorage.getItem("bran_token")
      const cachedRaw = localStorage.getItem("bran_user")
      if (tokenStillPresent && cachedRaw) {
        setState({ user: JSON.parse(cachedRaw) as User, token: tokenStillPresent, loading: false })
      } else {
        localStorage.removeItem("bran_token")
        localStorage.removeItem("bran_user")
        setState({ user: null, token: null, loading: false })
      }
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const login = useCallback((token: string, user: User) => {
    localStorage.setItem("bran_token", token)
    localStorage.setItem("bran_user", JSON.stringify(user))
    setState({ user, token, loading: false })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem("bran_token")
    localStorage.removeItem("bran_user")
    setState({ user: null, token: null, loading: false })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
