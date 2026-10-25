import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/lib/utils"

/** The form's submit button; shows a spinner and is disabled while pending. */
export function SubmitButton({
  pending,
  className,
  children,
}: {
  pending: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      aria-busy={pending || undefined}
      className={cn("w-full", className)}
    >
      {pending && <Spinner />}
      {children}
    </Button>
  )
}
