import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google"
import { useAuth } from "@/contexts/AuthContext"
import { authApi } from "@/lib/api"
import { toast, Toaster } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { User } from "@/types"
import { ShieldCheck, LogIn } from "lucide-react"

function normalizeAuthUser(raw: { id: string; email: string; name: string; avatarUrl: string | null; role: string }): User {
  return {
    id: raw.id,
    googleId: "",
    email: raw.email,
    name: raw.name,
    avatarUrl: raw.avatarUrl,
    description: null,
    phone: null,
    designation: null,
    roleId: "",
    isActive: true,
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    role: { id: "", name: raw.role },
    socialAccounts: [],
  }
}

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [adminDialogOpen, setAdminDialogOpen] = useState(false)
  const [adminEmail, setAdminEmail] = useState("")
  const [adminPassword, setAdminPassword] = useState("")

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true })
  }, [user, navigate])

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) {
      toast.error("Google login failed — no credential received")
      return
    }
    try {
      const data = await authApi.googleLogin(response.credential)
      login(data.token, normalizeAuthUser(data.user))
      toast.success("Welcome to the realm!")
      navigate("/dashboard")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Authentication failed")
    }
  }

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      toast.error("Email and password are required")
      return
    }
    setLoading(true)
    try {
      const data = await authApi.login(email.trim(), password.trim())
      login(data.token, normalizeAuthUser(data.user))
      toast.success("Welcome to the realm!")
      navigate("/dashboard")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminEmail.trim() || !adminPassword.trim()) {
      toast.error("Email and password are required")
      return
    }
    setLoading(true)
    try {
      const data = await authApi.login(adminEmail.trim(), adminPassword.trim())
      login(data.token, normalizeAuthUser(data.user))
      toast.success("Logged in as Admin")
      setAdminDialogOpen(false)
      navigate("/dashboard")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Admin login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,41,17,0.22),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(122,94,46,0.14),transparent_35%)] pointer-events-none" />

      <div className="relative w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <div className="text-center space-y-2">
          <h1 className="font-brand text-4xl tracking-wider text-accent">BRan</h1>
          <p className="text-muted-foreground">Enter the realm with your account</p>
        </div>

        <Button
          variant="outline"
          className="w-full gap-2 border-primary/40 hover:bg-primary/10"
          onClick={() => {
            setAdminEmail("")
            setAdminPassword("")
            setAdminDialogOpen(true)
          }}
          disabled={loading}
        >
          <ShieldCheck className="h-4 w-4 text-accent" />
          Login as Admin
        </Button>

        <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-accent" />
                Admin Login
              </DialogTitle>
              <DialogDescription>
                Enter your admin credentials to sign in.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdminLogin} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@example.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={loading}>
                <ShieldCheck className="h-4 w-4" />
                {loading ? "Signing in..." : "Sign In as Admin"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <div className="relative">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
            or sign in with credentials
          </span>
        </div>

        {/* Email / password form */}
        <form onSubmit={handleCredentialsLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full gap-2" disabled={loading}>
            <LogIn className="h-4 w-4" />
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="relative">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
            or continue with
          </span>
        </div>

        {/* Google OAuth */}
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => toast.error("Google login failed")}
            theme="filled_black"
            size="large"
            width="320"
            shape="pill"
          />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          By signing in, you agree to be bound by the laws of the realm.
        </p>
      </div>

      <Toaster
        theme="dark"
        toastOptions={{
          style: {
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            color: "hsl(var(--foreground))",
          },
        }}
      />
    </div>
  )
}
