import { ArrowLeftIcon } from "lucide-react"

/** The quiet way back to `/login` under an auth card's form. */
export function BackToLogin({ label }: { label: string }) {
  return (
    <a
      href="/login"
      className="inline-flex items-center gap-1.5 self-center rounded-sm text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
    >
      <ArrowLeftIcon className="size-4" aria-hidden="true" />
      {label}
    </a>
  )
}
