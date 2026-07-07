import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TeamHierarchyCanvas } from "@/components/hierarchy/TeamHierarchyCanvas"
import { ProjectHierarchyCanvas } from "@/components/hierarchy/ProjectHierarchyCanvas"
import { UserHierarchyCanvas } from "@/components/hierarchy/UserHierarchyCanvas"

export default function HierarchyPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-brand text-2xl tracking-wide text-accent">Hierarchy Editor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Build org-wide, team, and project reporting lines with an interactive graph.
        </p>
      </div>

      <Tabs defaultValue="org" className="space-y-4">
        <TabsList className="h-auto w-full max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="org" className="shrink-0">Org Hierarchy</TabsTrigger>
          <TabsTrigger value="team" className="shrink-0">Team Canvas</TabsTrigger>
          <TabsTrigger value="project" className="shrink-0">Project Canvas</TabsTrigger>
        </TabsList>
        <TabsContent value="org" className="space-y-4">
          <UserHierarchyCanvas />
        </TabsContent>
        <TabsContent value="team" className="space-y-4">
          <TeamHierarchyCanvas />
        </TabsContent>
        <TabsContent value="project" className="space-y-4">
          <ProjectHierarchyCanvas />
        </TabsContent>
      </Tabs>
    </div>
  )
}
