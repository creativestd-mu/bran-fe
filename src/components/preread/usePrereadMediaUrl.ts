import { useEffect, useState } from "react"
import { prereadApi } from "@/lib/api"

const urlCache = new Map<string, string>()

export function usePrereadMediaUrl(
  prereadId: string | undefined,
  nodeId: string | undefined,
  mediaId: string | undefined
) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!prereadId || !nodeId || !mediaId) {
      setUrl(null)
      return
    }

    const cacheKey = `${prereadId}:${nodeId}:${mediaId}`
    const cached = urlCache.get(cacheKey)
    if (cached) {
      setUrl(cached)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(false)

    prereadApi
      .fetchMediaBlob(prereadId, nodeId, mediaId)
      .then(({ blob }) => {
        if (cancelled) return
        const objectUrl = URL.createObjectURL(blob)
        urlCache.set(cacheKey, objectUrl)
        setUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [prereadId, nodeId, mediaId])

  return { url, loading, error }
}

export function revokePrereadMediaUrl(
  prereadId: string,
  nodeId: string,
  mediaId: string
) {
  const cacheKey = `${prereadId}:${nodeId}:${mediaId}`
  const existing = urlCache.get(cacheKey)
  if (existing) {
    URL.revokeObjectURL(existing)
    urlCache.delete(cacheKey)
  }
}
