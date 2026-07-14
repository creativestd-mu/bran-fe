import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { projectsApi, usersApi, workApi } from "@/lib/api"
import type { AudioWorkResult, Project, TaggingMapping, User, WorkUnit, WorkUnitStatus } from "@/types"
import { hasPermission, hasRole } from "@/types"
import { AssigneeSelect } from "@/components/work/AssigneeSelect"
import { TranscriptTagCanvas } from "@/components/work/TranscriptTagCanvas"
import {
  collectTaggingMappings,
  patchPayloadForMapping,
  taggingMappingKey,
} from "@/components/work/transcriptTagUtils"
import {
  firstValidationError,
  validateWorkContext,
  validateWorkSteps,
  validateWorkTitle,
} from "@/lib/validation"
import { formatDuration, useAudioRecorder } from "@/hooks/useAudioRecorder"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DateInput } from "@/components/ui/date-input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Loader2,
  Lock,
  Mic,
  Pencil,
  Plus,
  Square,
  Trash2,
  X,
} from "lucide-react"

type StepFormRow = {
  id?: string
  description: string
  deadline: string
  done: boolean
  assigneeId: string | null
  assigneeSpokenName?: string | null
  assignee?: WorkUnit["steps"][number]["assignee"]
}

type WorkForm = {
  title: string
  context: string
  status: WorkUnitStatus
  isPrivate: boolean
  projectId: string | null
  assignedToUserId: string | null
  assigneeSpokenName?: string | null
  steps: StepFormRow[]
}

const emptyStep = (): StepFormRow => ({
  description: "",
  deadline: "",
  done: false,
  assigneeId: null,
})

const emptyForm = (): WorkForm => ({
  title: "",
  context: "",
  status: "OPEN",
  isPrivate: false,
  projectId: null,
  assignedToUserId: null,
  steps: [],
})

function canManageUnit(unit: WorkUnit, userId: string | undefined, isManager: boolean) {
  if (!userId) return false
  if (unit.isPrivate) return unit.userId === userId
  return unit.userId === userId || unit.createdById === userId || isManager
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
}

function toIsoDeadline(value: string): string | null {
  if (!value.trim()) return null
  return new Date(value).toISOString()
}

function fromIsoDeadline(value: string | null): string {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function unitToForm(unit: WorkUnit): WorkForm {
  return {
    title: unit.title,
    context: unit.context,
    status: unit.status,
    isPrivate: unit.isPrivate,
    projectId: unit.projectId ?? null,
    assignedToUserId: unit.userId,
    assigneeSpokenName: unit.assigneeSpokenName,
    steps: unit.steps.map((s) => ({
      id: s.id,
      description: s.description,
      deadline: fromIsoDeadline(s.deadline),
      done: s.done,
      assigneeId: s.assigneeId,
      assigneeSpokenName: s.assigneeSpokenName,
      assignee: s.assignee,
    })),
  }
}

function formToPayload(form: WorkForm) {
  return {
    title: form.title.trim(),
    context: form.context.trim(),
    status: form.status,
    isPrivate: form.isPrivate,
    projectId: form.projectId ?? null,
    assignedToUserId: form.assignedToUserId,
    steps: form.steps.map((s) => ({
      description: s.description.trim(),
      deadline: toIsoDeadline(s.deadline),
      done: s.done,
      assigneeId: s.assigneeId,
    })),
  }
}

function validateForm(form: WorkForm) {
  return firstValidationError(
    validateWorkTitle(form.title),
    validateWorkContext(form.context),
    validateWorkSteps(form.steps)
  )
}

function stepsProgress(unit: WorkUnit) {
  const done = unit.steps.filter((s) => s.done).length
  return `${done}/${unit.steps.length}`
}

export default function WorkUnitsPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const recordingFilter = searchParams.get("recording")
  const isManager = hasRole(user, "admin", "manager", "superadmin")
  const canCreate = hasPermission(user, "create_tasks")

  const [tab, setTab] = useState<WorkUnitStatus>("OPEN")
  const [units, setUnits] = useState<WorkUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
  })

  const [users, setUsers] = useState<User[]>([])
  const [assigneeUsers, setAssigneeUsers] = useState<User[]>([])
  const [filters, setFilters] = useState({ userId: "all", from: "", to: "" })

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<WorkForm>(emptyForm())
  const [creating, setCreating] = useState(false)

  const [editing, setEditing] = useState<WorkUnit | null>(null)
  const [editForm, setEditForm] = useState<WorkForm>(emptyForm())
  const [saving, setSaving] = useState(false)

  const [deleting, setDeleting] = useState<WorkUnit | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [recordOpen, setRecordOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [audioResult, setAudioResult] = useState<AudioWorkResult | null>(null)
  const [editedTranscript, setEditedTranscript] = useState("")
  const [transcriptEditing, setTranscriptEditing] = useState(false)
  const [audioProjectOverrides, setAudioProjectOverrides] = useState<Record<string, string | null>>({})
  const [savingOverrides, setSavingOverrides] = useState(false)
  const [assigneeSavingKey, setAssigneeSavingKey] = useState<string | null>(null)
  const recorder = useAudioRecorder()

  const [projects, setProjects] = useState<Project[]>([])
  useEffect(() => {
    projectsApi.list().then(setProjects).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isManager) return
    usersApi
      .list({ page: 1, pageSize: 100, isActive: true })
      .then((res) => setUsers(res.items))
      .catch(() => {})
  }, [isManager])

  useEffect(() => {
    if (!canCreate && !isManager) return
    usersApi
      .listAll({ isActive: true })
      .then(setAssigneeUsers)
      .catch(() => {})
  }, [canCreate, isManager])

  const fetchUnits = useCallback(
    async (page = 1, status: WorkUnitStatus = tab) => {
      setLoading(true)
      try {
        const params: Parameters<typeof workApi.list>[0] = {
          page,
          pageSize: recordingFilter ? 100 : 20,
        }
        if (!recordingFilter) params.status = status
        if (isManager && filters.userId !== "all") params.userId = filters.userId
        if (filters.from) params.from = new Date(filters.from).toISOString()
        if (filters.to) {
          const end = new Date(filters.to)
          end.setHours(23, 59, 59, 999)
          params.to = end.toISOString()
        }
        const res = await workApi.list(params)
        const items = recordingFilter
          ? res.items.filter((unit) => unit.audioRecordingId === recordingFilter)
          : res.items
        setUnits(items)
        setPagination(
          recordingFilter
            ? {
                page: 1,
                pageSize: items.length || 20,
                total: items.length,
                totalPages: 1,
                hasNextPage: false,
              }
            : res.pagination
        )
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load work units")
      } finally {
        setLoading(false)
      }
    },
    [filters, isManager, recordingFilter, tab]
  )

  useEffect(() => {
    fetchUnits(1, tab)
  }, [fetchUnits, tab])

  const openEdit = (unit: WorkUnit) => {
    setEditing(unit)
    setEditForm(unitToForm(unit))
    if (unit.audioRecordingId || (unit.taggingMappings?.length ?? 0) > 0) {
      workApi
        .getById(unit.id)
        .then((full) => {
          setEditing(full)
          setEditForm(unitToForm(full))
        })
        .catch(() => {})
    }
  }

  useEffect(() => {
    const unitId = searchParams.get("unit")
    if (!unitId || loading || units.length === 0) return
    const unit = units.find((item) => item.id === unitId)
    if (unit) {
      openEdit(unit)
      setSearchParams({}, { replace: true })
    }
  }, [loading, searchParams, setSearchParams, units])

  const handleMappingAssignment = async (
    unitId: string,
    mapping: TaggingMapping,
    assigneeId: string | null
  ) => {
    const savingKey = taggingMappingKey(mapping)
    setAssigneeSavingKey(savingKey)
    try {
      const updated = await workApi.patchAssignments(unitId, patchPayloadForMapping(mapping, assigneeId))
      setUnits((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      if (editing?.id === updated.id) {
        setEditing(updated)
        setEditForm(unitToForm(updated))
      }
      if (audioResult) {
        setAudioResult((prev) => {
          if (!prev) return prev
          const workUnits = prev.workUnits.map((item) => (item.id === updated.id ? updated : item))
          return {
            ...prev,
            transcript: updated.transcript ?? prev.transcript,
            taggingMappings: collectTaggingMappings(workUnits, prev.taggingMappings),
            workUnits,
          }
        })
        if (updated.transcript) setEditedTranscript(updated.transcript)
      }
      toast.success("Assignee updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update assignee")
    } finally {
      setAssigneeSavingKey(null)
    }
  }

  const handleCreate = async () => {
    const validationError = validateForm(createForm)
    if (validationError) {
      toast.error(validationError)
      return
    }
    setCreating(true)
    try {
      await workApi.create(formToPayload(createForm))
      toast.success("Work unit created")
      setCreateOpen(false)
      setCreateForm(emptyForm())
      fetchUnits(1, tab)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create work unit")
    } finally {
      setCreating(false)
    }
  }

  const handleUpdate = async () => {
    if (!editing) return
    const validationError = validateForm(editForm)
    if (validationError) {
      toast.error(validationError)
      return
    }
    setSaving(true)
    try {
      const updated = await workApi.update(editing.id, formToPayload(editForm))
      setUnits((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
      toast.success("Work unit updated")
      setEditing(null)
      if (updated.status !== tab) fetchUnits(pagination.page, tab)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update work unit")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStepDone = async (unit: WorkUnit, stepIndex: number) => {
    const steps = unit.steps.map((s, i) => ({
      description: s.description,
      deadline: s.deadline,
      done: i === stepIndex ? !s.done : s.done,
      assigneeId: s.assigneeId,
    }))
    try {
      const updated = await workApi.update(unit.id, { steps })
      if (updated.status !== tab) {
        setUnits((prev) => prev.filter((u) => u.id !== updated.id))
        fetchUnits(pagination.page, tab)
        if (updated.status === "CLOSED" && tab === "OPEN") {
          toast.success("All steps done — work unit closed")
        } else if (updated.status === "OPEN" && tab === "CLOSED") {
          toast.success("Work unit reopened")
        }
      } else {
        setUnits((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update step")
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await workApi.delete(deleting.id)
      toast.success("Work unit deleted")
      setDeleting(null)
      fetchUnits(pagination.page, tab)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete work unit")
    } finally {
      setDeleteLoading(false)
    }
  }

  const closeRecordDialog = () => {
    setRecordOpen(false)
    setAudioResult(null)
    setEditedTranscript("")
    setTranscriptEditing(false)
    setAudioProjectOverrides({})
    recorder.reset()
  }

  const initAudioResult = (result: AudioWorkResult) => {
    setAudioResult(result)
    setEditedTranscript(result.transcript)
    setTranscriptEditing(false)
    const initialProjects: Record<string, string | null> = {}
    for (const unit of result.workUnits) {
      initialProjects[unit.id] = unit.projectId ?? null
    }
    setAudioProjectOverrides(initialProjects)
  }

  const handleUploadRecording = async () => {
    const blob = recorder.blob ?? (await recorder.stop())
    if (!blob || blob.size === 0) {
      toast.error("No recording to upload")
      return
    }
    setUploading(true)
    try {
      const result = await workApi.createAudio(blob, "memo.webm")
      initAudioResult(result)
      toast.success(`Created ${result.workUnits.length} work unit(s)`)
      fetchUnits(1, tab)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process recording")
    } finally {
      setUploading(false)
    }
  }

  const handleRegenerateFromTranscript = async () => {
    if (!audioResult) return
    const transcript = editedTranscript.trim()
    if (!transcript) {
      toast.error("Transcript is required")
      return
    }
    setRegenerating(true)
    try {
      await Promise.all(
        audioResult.workUnits.map((unit) => workApi.delete(unit.id).catch(() => {}))
      )
      const result = await workApi.regenerateFromTranscript(transcript)
      initAudioResult(result)
      toast.success(`Regenerated ${result.workUnits.length} work unit(s)`)
      fetchUnits(1, tab)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to regenerate work units")
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-brand text-2xl tracking-wide text-accent">Work Units</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Meeting outcomes and follow-ups — from voice memos or manual entry.
          </p>
        </div>
        {canCreate && (
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5"
              onClick={() => {
                setAudioResult(null)
                recorder.reset()
                setRecordOpen(true)
              }}
            >
              <Mic className="h-4 w-4" />
              Record memo
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setCreateForm({ ...emptyForm(), assignedToUserId: user?.id ?? null })
                setCreateOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              New work unit
            </Button>
          </div>
        )}
      </div>

      {recordingFilter && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2.5 text-sm">
          <p className="text-muted-foreground">
            Showing work units from a meeting recording.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setSearchParams({}, { replace: true })}
          >
            <X className="h-3.5 w-3.5" />
            Clear filter
          </Button>
        </div>
      )}

      {isManager && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
          <div className="min-w-[140px] flex-1 space-y-1">
            <Label className="text-xs text-muted-foreground">Person</Label>
            <Select
              value={filters.userId}
              onValueChange={(v) => setFilters((p) => ({ ...p, userId: v }))}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">From</Label>
            <DateInput
              value={filters.from}
              onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">To</Label>
            <DateInput
              value={filters.to}
              onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))}
            />
          </div>
          <Button size="sm" variant="secondary" onClick={() => fetchUnits(1, tab)}>
            Apply
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setFilters({ userId: "all", from: "", to: "" })}
            disabled={filters.userId === "all" && !filters.from && !filters.to}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      )}

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as WorkUnitStatus)
        }}
      >
        <TabsList>
          <TabsTrigger value="OPEN">Open</TabsTrigger>
          <TabsTrigger value="CLOSED">Closed</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <UnitList
            units={units}
            loading={loading}
            tab={tab}
            isManager={isManager}
            userId={user?.id}
            onEdit={openEdit}
            onDelete={setDeleting}
            onToggleStep={handleToggleStepDone}
            canManage={canManageUnit}
          />

          {!loading && pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>{pagination.total} units</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchUnits(pagination.page - 1, tab)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span>
                  {pagination.page} / {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={!pagination.hasNextPage}
                  onClick={() => fetchUnits(pagination.page + 1, tab)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New work unit</DialogTitle>
          </DialogHeader>
          <WorkUnitForm
            form={createForm}
            onChange={setCreateForm}
            projects={projects}
            assigneeUsers={assigneeUsers}
            currentUserId={user?.id}
            showOwnerPicker
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating} className="gap-2">
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit work unit</DialogTitle>
          </DialogHeader>
          <WorkUnitForm
            form={editForm}
            onChange={setEditForm}
            projects={projects}
            assigneeUsers={assigneeUsers}
            currentUserId={user?.id}
            showOwnerPicker
            editingUnit={editing ?? undefined}
          />
          {editing && (editing.transcript || editing.taggingMappings?.length) ? (
            <div className="space-y-2 border-t border-border/60 pt-4">
              <Label className="text-xs text-muted-foreground">
                Dictation — click a #tag to reassign
              </Label>
              <TranscriptTagCanvas
                transcript={editing.transcript ?? ""}
                mappings={collectTaggingMappings([editing], editing.taggingMappings)}
                users={assigneeUsers}
                currentUserId={user?.id}
                savingMappingKey={assigneeSavingKey}
                disabled={!canManageUnit(editing, user?.id, isManager) || editing.status !== "OPEN"}
                onAssignmentChange={(mapping, assigneeId) =>
                  handleMappingAssignment(editing.id, mapping, assigneeId)
                }
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Delete work unit?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground line-clamp-2">{deleting?.title}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recordOpen} onOpenChange={(open) => !open && closeRecordDialog()}>
        <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-4xl flex-col gap-4 overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{audioResult ? "Review work units" : "Record voice memo"}</DialogTitle>
          </DialogHeader>

          {!audioResult ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Describe your meetings and follow-ups. The recording will be transcribed and split
                into work units automatically.
              </p>

              <div className="flex flex-col items-center gap-4 rounded-lg border border-border/60 bg-card/40 p-6">
                {recorder.status === "recording" && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
                    Recording {formatDuration(recorder.durationMs)}
                  </div>
                )}

                {recorder.status === "stopped" && (
                  <p className="text-sm text-muted-foreground">
                    Recording ready ({formatDuration(recorder.durationMs)})
                  </p>
                )}

                {recorder.error && (
                  <p className="text-sm text-destructive">{recorder.error}</p>
                )}

                <div className="flex gap-2">
                  {recorder.status === "idle" || recorder.status === "error" ? (
                    <Button onClick={() => void recorder.start()} className="gap-2">
                      <Mic className="h-4 w-4" />
                      Start recording
                    </Button>
                  ) : recorder.status === "recording" ? (
                    <Button
                      variant="destructive"
                      onClick={() => void recorder.stop()}
                      className="gap-2"
                    >
                      <Square className="h-4 w-4" />
                      Stop
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => recorder.reset()}>
                        Re-record
                      </Button>
                      <Button
                        onClick={() => void handleUploadRecording()}
                        disabled={uploading}
                        className="gap-2"
                      >
                        {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                        Process recording
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs text-muted-foreground">Transcript</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setTranscriptEditing((value) => !value)}
                  >
                    {transcriptEditing ? "Show tags" : "Edit transcript"}
                  </Button>
                </div>
                {transcriptEditing ? (
                  <Textarea
                    value={editedTranscript}
                    onChange={(e) => setEditedTranscript(e.target.value)}
                    rows={8}
                    className="min-h-[180px] resize-y"
                    placeholder="Edit transcript…"
                  />
                ) : (
                  <TranscriptTagCanvas
                    transcript={audioResult.transcript}
                    mappings={collectTaggingMappings(audioResult.workUnits, audioResult.taggingMappings)}
                    users={assigneeUsers}
                    currentUserId={user?.id}
                    savingMappingKey={assigneeSavingKey}
                    onAssignmentChange={(mapping, assigneeId) =>
                      handleMappingAssignment(mapping.workUnitId, mapping, assigneeId)
                    }
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Work units ({audioResult.workUnits.length})
                </Label>
                <div className="space-y-2">
                  {audioResult.workUnits.length === 0 ? (
                    <p className="rounded-lg border border-border/60 p-4 text-center text-sm text-muted-foreground">
                      No work units yet. Save the transcript to regenerate.
                    </p>
                  ) : (
                    audioResult.workUnits.map((unit) => (
                      <div
                        key={unit.id}
                        className="space-y-2 rounded-lg border border-border/60 bg-background/60 p-3"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="min-w-0 break-words text-sm font-medium">{unit.title}</p>
                          {unit.isPrivate && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
                          {unit.createdBy && unit.createdBy.id !== unit.userId && (
                            <Badge variant="secondary" className="text-[10px]">
                              via {unit.createdBy.name}
                            </Badge>
                          )}
                        </div>
                        {unit.steps.length > 0 ? (
                          <ul className="space-y-1 text-xs text-muted-foreground">
                            {unit.steps.map((step) => (
                              <li key={step.id} className="flex min-w-0 gap-1.5">
                                <span className="shrink-0">•</span>
                                <span className="min-w-0 break-words">
                                  {step.description}
                                  {step.deadline ? (
                                    <span className="ml-1 opacity-80">
                                      (due {formatDateTime(step.deadline)})
                                    </span>
                                  ) : null}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        <div className="flex items-center gap-1.5">
                          <FolderKanban className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <Select
                            value={audioProjectOverrides[unit.id] ?? "none"}
                            onValueChange={(v) =>
                              setAudioProjectOverrides((prev) => ({
                                ...prev,
                                [unit.id]: v === "none" ? null : v,
                              }))
                            }
                          >
                            <SelectTrigger className="h-7 max-w-[200px] gap-1 border-0 bg-transparent px-1 text-xs text-muted-foreground shadow-none hover:bg-muted/40 focus:ring-0">
                              <SelectValue placeholder="No project" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No project</SelectItem>
                              {projects.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {audioResult && (
              <Button
                size="sm"
                variant="secondary"
                disabled={regenerating || editedTranscript.trim() === audioResult.transcript.trim()}
                onClick={() => void handleRegenerateFromTranscript()}
                className="gap-1.5"
                title="Save the edited transcript and re-generate work units from it"
              >
                {regenerating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save & regenerate
              </Button>
            )}
            <Button
              variant="outline"
              disabled={savingOverrides}
              onClick={async () => {
                if (!audioResult) {
                  closeRecordDialog()
                  return
                }
                setSavingOverrides(true)
                try {
                  for (const unit of audioResult.workUnits) {
                    const projectId = audioProjectOverrides[unit.id] ?? unit.projectId ?? null
                    if (projectId !== (unit.projectId ?? null)) {
                      await workApi.update(unit.id, { projectId })
                    }
                  }
                  fetchUnits(1, tab)
                } catch {
                  toast.error("Failed to save work unit updates")
                } finally {
                  setSavingOverrides(false)
                }
                closeRecordDialog()
              }}
            >
              {savingOverrides && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {audioResult ? "Done" : "Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function UnitList({
  units,
  loading,
  tab,
  isManager,
  userId,
  onEdit,
  onDelete,
  onToggleStep,
  canManage,
}: {
  units: WorkUnit[]
  loading: boolean
  tab: WorkUnitStatus
  isManager: boolean
  userId: string | undefined
  onEdit: (unit: WorkUnit) => void
  onDelete: (unit: WorkUnit) => void
  onToggleStep: (unit: WorkUnit, stepIndex: number) => void
  canManage: (unit: WorkUnit, userId: string | undefined, isManager: boolean) => boolean
}) {
  if (loading) {
    return (
      <div className="space-y-3 rounded-lg border border-border p-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    )
  }

  if (units.length === 0) {
    return (
      <p className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
        No {tab === "OPEN" ? "open" : "closed"} work units yet.
      </p>
    )
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {units.map((unit) => (
        <div key={unit.id} className="space-y-2 overflow-hidden p-4">
          <div className="flex gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 break-words text-sm font-medium">{unit.title}</p>
                {unit.isPrivate && (
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Private" />
                )}
                <Badge variant="outline" className="text-[10px]">
                  {stepsProgress(unit)} steps
                </Badge>
                <Badge variant={unit.status === "OPEN" ? "info" : "secondary"} className="text-[10px]">
                  {unit.status}
                </Badge>
                {unit.project && (
                  <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
                    <FolderKanban className="h-2.5 w-2.5" />
                    {unit.project.name}
                  </Badge>
                )}
              </div>
              <p className="break-words text-sm text-muted-foreground line-clamp-2">{unit.context}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span>Owner: {unit.user.name}</span>
                {unit.createdBy && unit.createdBy.id !== unit.userId && (
                  <span>via {unit.createdBy.name}</span>
                )}
                {tab === "OPEN" && unit.nextDueAt && (
                  <span>Next due {formatDateTime(unit.nextDueAt)}</span>
                )}
                {tab === "CLOSED" && unit.firstDueAt && (
                  <span>First due {formatDateTime(unit.firstDueAt)}</span>
                )}
                {tab === "CLOSED" && unit.closedAt && (
                  <span>Closed {formatDateTime(unit.closedAt)}</span>
                )}
                <span>Created {new Date(unit.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            {canManage(unit, userId, isManager) && tab === "OPEN" && (
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(unit)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => onDelete(unit)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          {unit.steps.length > 0 && (
            <ul className="space-y-3 pl-1">
              {unit.steps.map((step, i) => (
                <li key={step.id} className="space-y-2">
                  <div className="flex min-w-0 items-start gap-2 text-sm">
                    {canManage(unit, userId, isManager) ? (
                      <input
                        type="checkbox"
                        checked={step.done}
                        onChange={() => onToggleStep(unit, i)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-border"
                      />
                    ) : (
                      <span className="mt-1 h-4 w-4 shrink-0" />
                    )}
                    <span
                      className={`min-w-0 flex-1 break-all ${step.done ? "line-through text-muted-foreground" : ""}`}
                    >
                      {step.description}
                      {step.assignee ? (
                        <span className="ml-2 text-xs text-muted-foreground">· {step.assignee.name}</span>
                      ) : null}
                      {step.deadline && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          due {formatDateTime(step.deadline)}
                        </span>
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

function WorkUnitForm({
  form,
  onChange,
  projects,
  assigneeUsers,
  currentUserId,
  showOwnerPicker = false,
  editingUnit,
}: {
  form: WorkForm
  onChange: React.Dispatch<React.SetStateAction<WorkForm>>
  projects: Project[]
  assigneeUsers: User[]
  currentUserId?: string
  showOwnerPicker?: boolean
  editingUnit?: WorkUnit
}) {
  const updateStep = (index: number, patch: Partial<StepFormRow>) => {
    onChange((prev) => ({
      ...prev,
      steps: prev.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }))
  }

  const removeStep = (index: number) => {
    onChange((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }))
  }

  const addStep = () => {
    onChange((prev) => ({ ...prev, steps: [...prev.steps, emptyStep()] }))
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Title <span className="text-destructive">*</span></Label>
        <Input
          value={form.title}
          maxLength={500}
          placeholder="MER team sync"
          onChange={(e) => onChange((p) => ({ ...p, title: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Context <span className="text-destructive">*</span></Label>
        <Textarea
          rows={4}
          value={form.context}
          maxLength={8000}
          placeholder="What happened and why it matters"
          onChange={(e) => onChange((p) => ({ ...p, context: e.target.value }))}
        />
      </div>
      {showOwnerPicker && (
        <div className="space-y-1.5">
          <Label>Owner</Label>
          {editingUnit?.createdBy && editingUnit.createdBy.id !== editingUnit.userId && (
            <p className="text-xs text-muted-foreground">Assigned by {editingUnit.createdBy.name}</p>
          )}
          <AssigneeSelect
            users={assigneeUsers}
            currentUserId={currentUserId}
            value={form.assignedToUserId}
            onChange={(next) => onChange((prev) => ({ ...prev, assignedToUserId: next ?? currentUserId ?? null }))}
            includeUnassigned={false}
            placeholder="Select owner"
          />
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Project</Label>
        <Select
          value={form.projectId ?? "none"}
          onValueChange={(v) => onChange((p) => ({ ...p, projectId: v === "none" ? null : v }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="No project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No project</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-6">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select
            value={form.status}
            onValueChange={(v) => onChange((p) => ({ ...p, status: v as WorkUnitStatus }))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Switch
            checked={form.isPrivate}
            onCheckedChange={(checked) => onChange((p) => ({ ...p, isPrivate: checked }))}
          />
          <Label className="cursor-pointer">Private (owner only)</Label>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Steps</Label>
          <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addStep}>
            <Plus className="h-3.5 w-3.5" />
            Add step
          </Button>
        </div>
        {form.steps.length === 0 ? (
          <p className="text-xs text-muted-foreground">No steps yet.</p>
        ) : (
          <div className="space-y-2">
            {form.steps.map((step, i) => (
              <div
                key={i}
                className="flex flex-wrap items-start gap-2 rounded-lg border border-border/60 p-3"
              >
                <input
                  type="checkbox"
                  checked={step.done}
                  onChange={(e) => updateStep(i, { done: e.target.checked })}
                  className="mt-2 h-4 w-4 rounded border-border"
                  title="Done"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    value={step.description}
                    maxLength={2000}
                    placeholder="Step description"
                    onChange={(e) => updateStep(i, { description: e.target.value })}
                  />
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Due date & time</Label>
                    <Input
                      type="datetime-local"
                      value={step.deadline}
                      onChange={(e) => updateStep(i, { deadline: e.target.value })}
                      className="max-w-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Step assignee</Label>
                    <AssigneeSelect
                      users={assigneeUsers}
                      currentUserId={currentUserId}
                      value={step.assigneeId}
                      onChange={(next) => updateStep(i, { assigneeId: next })}
                      className="max-w-xs"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground"
                  onClick={() => removeStep(i)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
