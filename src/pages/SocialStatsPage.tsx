import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { socialApi, usersApi } from "@/lib/api"
import type { SocialStats, SocialContent, SocialContentItem, SocialAccount } from "@/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Eye, ThumbsUp, MessageCircle, Users, PlayCircle } from "lucide-react"

const formatMetric = (v: unknown) => {
  if (v == null) return "—"
  if (typeof v === "number") return new Intl.NumberFormat().format(v)
  return String(v)
}

export default function SocialStatsPage() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [platform, setPlatform] = useState<"youtube" | "instagram">("youtube")
  const [stats, setStats] = useState<SocialStats | null>(null)
  const [content, setContent] = useState<SocialContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [detailItem, setDetailItem] = useState<SocialContentItem | null>(null)

  useEffect(() => {
    if (!user) return
    usersApi.getSocialAccounts(user.id).then(setAccounts).catch(() => {})
  }, [user])

  const platformAccounts = accounts.filter(
    (a) => a.platform.toLowerCase() === platform
  )

  useEffect(() => {
    if (!platformAccounts.length) {
      setStats(null)
      setContent([])
      setLoading(false)
      return
    }

    const load = async () => {
      setLoading(true)
      try {
        const acc = platformAccounts[0]
        const [statsRes, contentRes] = await Promise.all([
          socialApi.getStats(platform, acc.platformAccountId),
          socialApi.getContent(platform, acc.platformAccountId, 12),
        ])
        setStats(statsRes)
        setContent(contentRes.items || [])
      } catch {
        setStats(null)
        setContent([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [platform, accounts])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-brand text-2xl tracking-wide text-accent">Social Stats</h1>
        <p className="text-sm text-muted-foreground mt-1">Monitor your social media performance</p>
      </div>

      <Tabs value={platform} onValueChange={(v) => setPlatform(v as "youtube" | "instagram")}>
        <TabsList>
          <TabsTrigger value="youtube" className="gap-2">
            <PlayCircle className="h-4 w-4 text-red-500" /> YouTube
          </TabsTrigger>
          <TabsTrigger value="instagram" className="gap-2">
            <svg className="h-4 w-4 text-pink-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg> Instagram
          </TabsTrigger>
        </TabsList>

        <TabsContent value={platform} className="space-y-6 mt-4">
          {loading ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
              </div>
              <Skeleton className="h-64" />
            </div>
          ) : !platformAccounts.length ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 space-y-3">
                {platform === "youtube" ? <PlayCircle className="h-12 w-12 text-red-500/40" /> : <Eye className="h-12 w-12 text-pink-500/40" />}
                <p className="text-muted-foreground">No {platform} account linked.</p>
                <p className="text-xs text-muted-foreground">Link a {platform} account in your profile to see stats.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {stats && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {platform === "youtube" ? (
                    <>
                      <MetricCard icon={<Users className="h-4 w-4" />} label="Subscribers" value={formatMetric(stats.metrics.subscribers)} />
                      <MetricCard icon={<Eye className="h-4 w-4" />} label="Total Views" value={formatMetric(stats.metrics.views)} />
                      <MetricCard icon={<PlayCircle className="h-4 w-4" />} label="Videos" value={formatMetric(stats.metrics.videoCount)} />
                      <MetricCard icon={<ThumbsUp className="h-4 w-4" />} label="Likes" value={formatMetric(stats.metrics.likes)} />
                    </>
                  ) : (
                    <>
                      <MetricCard icon={<Users className="h-4 w-4" />} label="Followers" value={formatMetric(stats.metrics.followers)} />
                      <MetricCard icon={<Eye className="h-4 w-4" />} label="Impressions" value={formatMetric(stats.metrics.views)} />
                      <MetricCard icon={<ThumbsUp className="h-4 w-4" />} label="Likes" value={formatMetric(stats.metrics.likes)} />
                      <MetricCard icon={<MessageCircle className="h-4 w-4" />} label="Comments" value={formatMetric(stats.metrics.comments)} />
                    </>
                  )}
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-accent">Recent Content</CardTitle>
                  <CardDescription>{content.length} items</CardDescription>
                </CardHeader>
                <CardContent>
                  {content.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No content found.</p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {content.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-lg border border-border overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => setDetailItem(item)}
                        >
                          {item.thumbnailUrl && (
                            <div className="aspect-video bg-muted">
                              <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="p-3 space-y-2">
                            <p className="text-sm font-medium line-clamp-2">{item.title || "Untitled"}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {item.metrics.views != null && <span>{formatMetric(item.metrics.views)} views</span>}
                              {item.metrics.likes != null && <span>{formatMetric(item.metrics.likes)} likes</span>}
                            </div>
                            {item.publishedAt && (
                              <p className="text-xs text-muted-foreground">
                                {new Date(item.publishedAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detailItem?.title || "Content Details"}</DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-4">
              {detailItem.thumbnailUrl && (
                <img src={detailItem.thumbnailUrl} alt="" className="w-full rounded-lg" />
              )}
              {detailItem.description && (
                <p className="text-sm text-muted-foreground">{detailItem.description}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(detailItem.metrics).map(([key, val]) => (
                  <div key={key} className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</p>
                    <p className="text-lg font-semibold text-accent">{formatMetric(val)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className="text-accent">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-accent">{value}</div>
      </CardContent>
    </Card>
  )
}
