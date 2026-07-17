import { useCallback, useEffect, useState } from "react"
import Markdown from "react-markdown"
import { etaApi } from "@/lib/api"
import type { AttendancePolicyDoc } from "@/types"
import { AttendanceSubNav } from "@/components/attendance/AttendanceSubNav"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Loader2, Pencil, Save, X } from "lucide-react"

function formatUpdatedAt(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso))
}

export default function AttendancePoliciesPage() {
  const [doc, setDoc] = useState<AttendancePolicyDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await etaApi.getPolicies()
      setDoc(data)
      setDraft(data.bodyMd)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load policies")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const startEdit = () => {
    setDraft(doc?.bodyMd ?? "")
    setEditing(true)
  }

  const cancelEdit = () => {
    setDraft(doc?.bodyMd ?? "")
    setEditing(false)
  }

  const save = async () => {
    setSaving(true)
    try {
      const data = await etaApi.updatePolicies({ bodyMd: draft })
      setDoc(data)
      setDraft(data.bodyMd)
      setEditing(false)
      toast.success("Policies saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save policies")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="page-header">
        <div className="min-w-0">
          <h1 className="font-brand text-2xl tracking-wide text-accent sm:text-3xl">
            Attendance policies
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Leave, WFH, ETA rules and approval SOPs. Edit anytime — markdown supported.
          </p>
          {doc && (
            <p className="mt-1 text-xs text-muted-foreground">
              Last updated {formatUpdatedAt(doc.updatedAt)}
              {doc.updatedBy?.name ? ` · ${doc.updatedBy.name}` : ""}
            </p>
          )}
        </div>
        <div className="page-toolbar">
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={cancelEdit} disabled={saving}>
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button size="sm" onClick={() => void save()} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={startEdit} disabled={loading}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <AttendanceSubNav />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : editing ? (
        <div className="space-y-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[420px] font-mono text-sm leading-relaxed"
            placeholder={[
              "# Attendance policies",
              "",
              "## ETA",
              "- Post by …",
              "",
              "## WFH",
              "- Approval SOP …",
              "",
              "## Leave / Comp off",
              "- Timelines …",
            ].join("\n")}
          />
          <p className="text-xs text-muted-foreground">
            Tip: use headings (`##`), lists (`-`), and bold (`**text**`). Preview updates after you save.
          </p>
        </div>
      ) : !doc?.bodyMd.trim() ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-card/40 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">No policy written yet.</p>
          <Button className="mt-4" size="sm" onClick={startEdit}>
            <Pencil className="h-4 w-4" />
            Write policies
          </Button>
        </div>
      ) : (
        <article className="prose prose-invert prose-sm max-w-none rounded-xl border border-border/70 bg-card/50 p-4 sm:p-6 dark:prose-invert [&_*]:break-words [&_a]:text-accent [&_h1]:text-accent [&_h2]:text-accent [&_h3]:text-accent">
          <Markdown>{doc.bodyMd}</Markdown>
        </article>
      )}
    </div>
  )
}
