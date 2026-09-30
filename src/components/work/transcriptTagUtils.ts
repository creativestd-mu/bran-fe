import type { TaggingMapping } from "@/types"

export type TranscriptSegment =
  | { type: "text"; text: string; highlighted?: boolean }
  | {
      type: "tag"
      mappingKey: string
      label: string
      mapping: TaggingMapping
      highlighted?: boolean
    }

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

interface ExcerptRegion {
  start: number
  end: number
  mappingKey: string
  mapping: TaggingMapping
  nameStart: number | null
  nameEnd: number | null
  label: string | null
}

function findNameInExcerpt(
  excerpt: string,
  mapping: TaggingMapping
): { start: number; end: number; label: string } | null {
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
  // Never fabricate a tag position. Doing so replaces the beginning of the
  // transcript with a label that was not present in the source text.
  return null
}

function findExcerptRegions(transcript: string, mappings: TaggingMapping[]): ExcerptRegion[] {
  const regions: ExcerptRegion[] = []
  const lowerTranscript = transcript.toLowerCase()

  for (const mapping of mappings) {
    const excerpt = mapping.sourceExcerpt?.trim()
    if (!excerpt) continue

    const excerptIndex = lowerTranscript.indexOf(excerpt.toLowerCase())
    if (excerptIndex === -1) continue

    const excerptSlice = transcript.slice(excerptIndex, excerptIndex + excerpt.length)
    const nameMatch = findNameInExcerpt(excerptSlice, mapping)

    regions.push({
      start: excerptIndex,
      end: excerptIndex + excerpt.length,
      mappingKey: taggingMappingKey(mapping),
      mapping,
      nameStart: nameMatch ? excerptIndex + nameMatch.start : null,
      nameEnd: nameMatch ? excerptIndex + nameMatch.end : null,
      label: nameMatch?.label ?? null,
    })
  }

  // Prefer longer excerpts first so nested/overlapping quotes don't wipe the main source.
  regions.sort((a, b) => a.start - b.start || b.end - a.end || a.end - b.end)

  const deduped: ExcerptRegion[] = []
  for (const region of regions) {
    const overlaps = deduped.some(
      (existing) => region.start < existing.end && region.end > existing.start
    )
    if (!overlaps) deduped.push(region)
  }

  return deduped.sort((a, b) => a.start - b.start)
}

export function buildTranscriptSegments(
  transcript: string,
  mappings: TaggingMapping[]
): TranscriptSegment[] {
  if (!transcript) return []
  const regions = findExcerptRegions(transcript, mappings)
  if (regions.length === 0) return [{ type: "text", text: transcript }]

  const segments: TranscriptSegment[] = []
  let cursor = 0

  for (const region of regions) {
    if (region.start < cursor) continue
    if (region.start > cursor) {
      segments.push({ type: "text", text: transcript.slice(cursor, region.start) })
    }

    const hasName =
      region.nameStart != null &&
      region.nameEnd != null &&
      region.label != null &&
      region.nameStart >= region.start &&
      region.nameEnd <= region.end

    if (!hasName) {
      segments.push({
        type: "text",
        text: transcript.slice(region.start, region.end),
        highlighted: true,
      })
      cursor = region.end
      continue
    }

    if (region.nameStart! > region.start) {
      segments.push({
        type: "text",
        text: transcript.slice(region.start, region.nameStart!),
        highlighted: true,
      })
    }

    segments.push({
      type: "tag",
      mappingKey: region.mappingKey,
      label: region.label!,
      mapping: region.mapping,
      highlighted: true,
    })

    if (region.nameEnd! < region.end) {
      segments.push({
        type: "text",
        text: transcript.slice(region.nameEnd!, region.end),
        highlighted: true,
      })
    }

    cursor = region.end
  }

  if (cursor < transcript.length) {
    segments.push({ type: "text", text: transcript.slice(cursor) })
  }

  return segments
}
