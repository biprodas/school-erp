import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/lib/utils"

/** The form's submit button; shows a spinner and is disabled while pending. */
export function SubmitButton({
  pending,
  disabled = false,
  className,
  children,
}: {
  pending: boolean
  /** Not ready to send yet (pending disables it too). */
  disabled?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className={cn("w-full", className)}
    >
      {pending && <Spinner />}
      {children}
    </Button>
  )
}
