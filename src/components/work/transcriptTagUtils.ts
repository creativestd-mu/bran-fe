import type { TaggingMapping } from "@/types"

export type TranscriptSegment =
  | { type: "text"; text: string }
  | { type: "tag"; mappingKey: string; label: string; mapping: TaggingMapping }

export function taggingMappingKey(mapping: TaggingMapping): string {
  return `${mapping.target}:${mapping.workUnitId}:${mapping.stepId ?? "owner"}`
}

export function collectTaggingMappings(
  units: Array<{ taggingMappings?: TaggingMapping[] }>,
  topLevel?: TaggingMapping[]
): TaggingMapping[] {
  const fromUnits = units.flatMap((unit) => unit.taggingMappings ?? [])
  if (fromUnits.length) return fromUnits
  return topLevel ?? []
}

export function patchPayloadForMapping(
  mapping: TaggingMapping,
  assigneeId: string | null
): {
  ownerUserId?: string | null
  stepAssignments?: Array<{ stepId: string; assigneeId: string | null }>
} {
  if (mapping.target === "work_unit_owner") {
    return { ownerUserId: assigneeId }
  }
  if (!mapping.stepId) return {}
  return { stepAssignments: [{ stepId: mapping.stepId, assigneeId }] }
}

function tagLabel(mapping: TaggingMapping): string {
  return mapping.assignee?.name ?? mapping.spokenName ?? "Unassigned"
}

interface TagAnchor {
  start: number
  end: number
  mappingKey: string
  label: string
  mapping: TaggingMapping
}

function findNameInExcerpt(excerpt: string, mapping: TaggingMapping): { start: number; end: number; label: string } | null {
  const candidates = [mapping.spokenName, mapping.assignee?.name].filter(
    (value): value is string => Boolean(value?.trim())
  )
  const lowerExcerpt = excerpt.toLowerCase()
  for (const candidate of candidates) {
    const trimmed = candidate.trim()
    const index = lowerExcerpt.indexOf(trimmed.toLowerCase())
    if (index !== -1) {
      return {
        start: index,
        end: index + trimmed.length,
        label: excerpt.slice(index, index + trimmed.length),
      }
    }
  }
  const fallback = tagLabel(mapping)
  if (fallback === "Unassigned") return null
  return { start: 0, end: Math.min(fallback.length, excerpt.length), label: fallback }
}

function findTagAnchors(transcript: string, mappings: TaggingMapping[]): TagAnchor[] {
  const anchors: TagAnchor[] = []
  const lowerTranscript = transcript.toLowerCase()

  for (const mapping of mappings) {
    const excerpt = mapping.sourceExcerpt?.trim()
    if (!excerpt) continue

    const excerptIndex = lowerTranscript.indexOf(excerpt.toLowerCase())
    if (excerptIndex === -1) continue

    const excerptSlice = transcript.slice(excerptIndex, excerptIndex + excerpt.length)
    const nameMatch = findNameInExcerpt(excerptSlice, mapping)
    if (!nameMatch) continue

    anchors.push({
      start: excerptIndex + nameMatch.start,
      end: excerptIndex + nameMatch.end,
      mappingKey: taggingMappingKey(mapping),
      label: nameMatch.label,
      mapping,
    })
  }

  anchors.sort((a, b) => a.start - b.start || b.end - a.end)

  const deduped: TagAnchor[] = []
  for (const anchor of anchors) {
    const overlaps = deduped.some(
      (existing) =>
        anchor.start < existing.end &&
        anchor.end > existing.start &&
        existing.mapping.assigneeId === anchor.mapping.assigneeId &&
        existing.label.toLowerCase() === anchor.label.toLowerCase()
    )
    if (!overlaps) deduped.push(anchor)
  }

  return deduped
}

export function buildTranscriptSegments(transcript: string, mappings: TaggingMapping[]): TranscriptSegment[] {
  if (!transcript) return []
  const anchors = findTagAnchors(transcript, mappings)
  if (anchors.length === 0) return [{ type: "text", text: transcript }]

  const segments: TranscriptSegment[] = []
  let cursor = 0

  for (const anchor of anchors) {
    if (anchor.start < cursor) continue
    if (anchor.start > cursor) {
      segments.push({ type: "text", text: transcript.slice(cursor, anchor.start) })
    }
    segments.push({
      type: "tag",
      mappingKey: anchor.mappingKey,
      label: anchor.label,
      mapping: anchor.mapping,
    })
    cursor = anchor.end
  }

  if (cursor < transcript.length) {
    segments.push({ type: "text", text: transcript.slice(cursor) })
  }

  return segments
}
