import * as React from "react"
import { Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

const DateInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div className={cn("relative inline-flex h-9 w-[158px] shrink-0", className)}>
        <input
          type="date"
          ref={ref}
          className={cn(
            "h-full w-full appearance-none rounded-xl border border-border/80 bg-card/70 py-2 pl-3 pr-9 text-sm text-foreground shadow-sm ring-offset-background",
            "placeholder:text-muted-foreground/75",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            // Stretch the native picker hit-area over the custom icon; hide the native glyph
            "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-y-0 [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:z-10 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-9 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
          )}
          {...props}
        />
        <Calendar
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
    )
  }
)
DateInput.displayName = "DateInput"

export { DateInput }
