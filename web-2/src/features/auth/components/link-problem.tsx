import { LinkIcon } from "lucide-react"

import { buttonVariants } from "~/components/ui/button"

import { AuthCard } from "./auth-card"

/** An emailed link that doesn't work (unknown, used or expired). */
export function LinkProblem({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action: { href: string; label: string }
}) {
  return (
    <AuthCard title={title}>
      <div className="flex items-start gap-3 text-muted-foreground">
        <LinkIcon className="mt-1 size-4 shrink-0" aria-hidden="true" />
        <p>{body}</p>
      </div>
      <a href={action.href} className={buttonVariants({ size: "lg" })}>
        {action.label}
      </a>
    </AuthCard>
  )
}
