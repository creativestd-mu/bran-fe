import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, CheckCircle2, Undo2, Redo2, Save, Upload, Sparkles } from "lucide-react"

interface HierarchyToolbarProps {
  saving: boolean
  canUndo: boolean
  canRedo: boolean
  status?: string
  onSaveDraft: () => void
  onPublish: () => void
  onValidate: () => void
  onUndo: () => void
  onRedo: () => void
  onAutoLayout: () => void
  onExportPng: () => void
  onExportPdf: () => void
}

export function HierarchyToolbar({
  saving,
  canUndo,
  canRedo,
  status,
  onSaveDraft,
  onPublish,
  onValidate,
  onUndo,
  onRedo,
  onAutoLayout,
  onExportPng,
  onExportPdf,
}: HierarchyToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
      <Button size="sm" variant="outline" className="gap-2" disabled={!canUndo} onClick={onUndo}>
        <Undo2 className="h-4 w-4" /> Undo
      </Button>
      <Button size="sm" variant="outline" className="gap-2" disabled={!canRedo} onClick={onRedo}>
        <Redo2 className="h-4 w-4" /> Redo
      </Button>
      <Button size="sm" variant="outline" className="gap-2" onClick={onAutoLayout}>
        <Sparkles className="h-4 w-4" /> Auto layout
      </Button>
      <Button size="sm" variant="outline" className="gap-2" onClick={onValidate}>
        <CheckCircle2 className="h-4 w-4" /> Validate
      </Button>
      <Button size="sm" variant="outline" className="gap-2" onClick={onExportPng}>
        <Download className="h-4 w-4" /> Export PNG
      </Button>
      <Button size="sm" variant="outline" className="gap-2" onClick={onExportPdf}>
        <Download className="h-4 w-4" /> Export PDF
      </Button>

      <div className="ml-auto flex items-center gap-2">
        {status && (
          <Badge variant="outline" className="max-w-72 truncate">
            {status}
          </Badge>
        )}
        <Button size="sm" variant="outline" className="gap-2" disabled={saving} onClick={onSaveDraft}>
          <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Draft"}
        </Button>
        <Button size="sm" className="gap-2" disabled={saving} onClick={onPublish}>
          <Upload className="h-4 w-4" /> {saving ? "Publishing..." : "Publish Hierarchy"}
        </Button>
      </div>
    </div>
  )
}
