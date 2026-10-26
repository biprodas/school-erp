import { LinkIcon, type LucideIcon } from "lucide-react"

import { buttonVariants } from "~/components/ui/button"

import { AuthCard } from "./auth-card"

/**
 * An emailed link that doesn't work (unknown, used or expired). `icon`
 * says which (a broken link by default); `children` go under the action,
 * e.g. who to ask for a new link.
 */
export function LinkProblem({
  title,
  body,
  action,
  icon: Icon = LinkIcon,
  children,
}: {
  title: string
  body: string
  action: { href: string; label: string }
  icon?: LucideIcon
  children?: React.ReactNode
}) {
  return (
    <AuthCard title={title}>
      <div className="flex items-start gap-3 text-muted-foreground">
        <Icon className="mt-1 size-4 shrink-0" aria-hidden="true" />
        <p>{body}</p>
      </div>
      <a href={action.href} className={buttonVariants({ size: "lg" })}>
        {action.label}
      </a>
      {children}
    </AuthCard>
  )
}
