import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ShieldX } from "lucide-react"

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <ShieldX className="h-16 w-16 text-destructive/60" />
      <h1 className="font-brand text-2xl text-accent">Access Denied</h1>
      <p className="text-muted-foreground max-w-md">
        You do not have permission to access this page. Contact an administrator if you believe this is an error.
      </p>
      <Button asChild variant="outline">
        <Link to="/dashboard">Return to Dashboard</Link>
      </Button>
    </div>
  )
}
