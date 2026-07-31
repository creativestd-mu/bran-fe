import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { ReparentMode } from "./hierarchyUtils"

export interface ReparentTeamPrompt {
  personName: string
  reportCount: number
  previousManagerName: string | null
  newManagerName: string | null
}

interface ReparentTeamDialogProps {
  open: boolean
  prompt: ReparentTeamPrompt | null
  onCancel: () => void
  onConfirm: (mode: ReparentMode) => void
}

export function ReparentTeamDialog({ open, prompt, onCancel, onConfirm }: ReparentTeamDialogProps) {
  if (!prompt) return null

  const destination = prompt.newManagerName ? `under ${prompt.newManagerName}` : "to top level"
  const leaveReportsWith = prompt.previousManagerName ?? "no manager (top level)"

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move {prompt.personName}?</DialogTitle>
          <DialogDescription>
            {prompt.personName} has {prompt.reportCount} direct report
            {prompt.reportCount === 1 ? "" : "s"}. Choose whether their team moves with them {destination}, or
            stays behind under {leaveReportsWith}.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button onClick={() => onConfirm("with_team")}>
            Move {prompt.personName} and their whole team
          </Button>
          <Button variant="outline" onClick={() => onConfirm("user_only")}>
            Move only {prompt.personName}
            <span className="ml-1 font-normal text-muted-foreground">
              (reports go to {leaveReportsWith})
            </span>
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
