import type { ReactNode } from "react"
import { AlertCircleIcon, InboxIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type FeedbackStateProps = Readonly<{
  title: string
  description?: string
  action?: ReactNode
  className?: string
}>

function LoadingState({
  label,
  className,
}: Readonly<{ label: string; className?: string }>) {
  return (
    <div
      className={cn("w-full max-w-3xl space-y-4", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-2/5" aria-hidden="true" />
      <Skeleton className="h-24 w-full" aria-hidden="true" />
      <Skeleton className="h-24 w-full" aria-hidden="true" />
    </div>
  )
}

function EmptyState({ title, description, action, className }: FeedbackStateProps) {
  return (
    <Card className={cn("w-full max-w-xl border-dashed text-center", className)}>
      <CardHeader className="items-center">
        <InboxIcon className="size-8 text-muted-foreground" aria-hidden="true" />
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      {(description || action) && (
        <CardContent className="flex flex-col items-center gap-4 text-muted-foreground">
          {description && <p>{description}</p>}
          {action}
        </CardContent>
      )}
    </Card>
  )
}

function ErrorState({ title, description, action, className }: FeedbackStateProps) {
  return (
    <Alert variant="destructive" className={cn("max-w-xl", className)}>
      <AlertCircleIcon aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      {description && <AlertDescription>{description}</AlertDescription>}
      {action && <div className="col-start-2 mt-3">{action}</div>}
    </Alert>
  )
}

export { EmptyState, ErrorState, LoadingState }
