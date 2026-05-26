import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-brand text-2xl tracking-wide text-accent">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Application configuration</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-accent">General</CardTitle>
          <CardDescription>App-level settings and configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">
            No configurable settings at this time.
          </p>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions — proceed with caution</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            User deactivation and other destructive operations will be available here. Manage user status from the Users page.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
