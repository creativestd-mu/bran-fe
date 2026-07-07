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
        <TabsList>
          <TabsTrigger value="org">Org Hierarchy</TabsTrigger>
          <TabsTrigger value="team">Team Hierarchy Canvas</TabsTrigger>
          <TabsTrigger value="project">Project Hierarchy Canvas</TabsTrigger>
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
