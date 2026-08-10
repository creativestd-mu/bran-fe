import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-muted text-muted-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "border-border/70 bg-card/55 text-muted-foreground",
        success:
          "border-emerald-700/20 bg-emerald-500/15 text-emerald-800 dark:border-transparent dark:bg-emerald-600/20 dark:text-emerald-400",
        warning:
          "border-amber-700/25 bg-amber-500/20 text-amber-800 dark:border-transparent dark:bg-amber-600/20 dark:text-amber-400",
        info:
          "border-blue-700/20 bg-blue-500/15 text-blue-800 dark:border-transparent dark:bg-blue-600/20 dark:text-blue-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
