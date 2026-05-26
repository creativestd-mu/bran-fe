import { useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sparkles, FileSpreadsheet, Wrench, Flame } from "lucide-react"
import { KhushiToolModal } from "@/components/utility/KhushiToolModal"

interface ToolDefinition {
  id: string
  name: string
  description: string
  badge?: string
  icon: React.ReactNode
  accent: string
  onOpen: () => void
}

export default function UtilityPage() {
  const [khushiOpen, setKhushiOpen] = useState(false)

  const tools: ToolDefinition[] = [
    {
      id: "khushi",
      name: "Khushi's Tool",
      description:
        "Upload Instagram reels via an Excel sheet, view all stats, and instantly highlight reels that have crossed 100k plays.",
      badge: "Reels Analyzer",
      icon: <Sparkles className="h-6 w-6" />,
      accent: "from-pink-500/20 to-fuchsia-500/5 text-pink-500",
      onOpen: () => setKhushiOpen(true),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-brand text-2xl tracking-wide text-accent flex items-center gap-2">
            <Wrench className="h-6 w-6" />
            Utility
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Handy in-app tools to speed up everyday workflows.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <Card
            key={tool.id}
            className="group flex flex-col overflow-hidden transition-colors hover:border-primary/50"
          >
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${tool.accent}`}
                >
                  {tool.icon}
                </div>
                {tool.badge && (
                  <Badge variant="secondary" className="gap-1">
                    <FileSpreadsheet className="h-3 w-3" />
                    {tool.badge}
                  </Badge>
                )}
              </div>
              <div>
                <CardTitle className="text-lg text-accent">{tool.name}</CardTitle>
                <CardDescription className="mt-1.5">
                  {tool.description}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="mt-auto pt-0">
              <Button
                onClick={tool.onOpen}
                className="w-full gap-2"
                type="button"
              >
                <Flame className="h-4 w-4" />
                Open {tool.name}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <KhushiToolModal open={khushiOpen} onOpenChange={setKhushiOpen} />
    </div>
  )
}
