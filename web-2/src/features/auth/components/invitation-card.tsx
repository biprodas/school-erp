import { ClockIcon, MailIcon, PhoneIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { Badge } from "~/components/ui/badge"

import { SchoolRule } from "./school-rule"

/**
 * An invitation as a letter on the school's paper: who it's from, the
 * person it's for, what they'll be in the school (roles, system ones
 * translated, "School admin" once) and the account they'll sign in with,
 * above the school's double rule; then the step that accepts it (`step`
 * names it, `children` is its form).
 * Until when the link works goes under the card.
 */
export function InvitationCard({
  school,
  name,
  account,
  roles,
  isAdmin,
  step,
  validUntil,
  children,
}: {
  school: string
  name: string
  account: string
  roles: string[]
  isAdmin: boolean
  step: { title: string; description: string }
  validUntil: string
  children: React.ReactNode
}) {
  const t = useTranslations("auth.activate")
  const tr = useTranslations("shell.roles")
  const label = (role: string) =>
    tr.has(role as never) ? tr(role as never) : role.replaceAll("_", " ")
  const badges = [
    ...new Set([...(isAdmin ? [label("admin")] : []), ...roles.map(label)]),
  ]
  const AccountIcon = account.includes("@") ? MailIcon : PhoneIcon

  return (
    <>
      <article
        aria-labelledby="invitation-title"
        className="overflow-hidden rounded-xl border bg-card shadow-sm"
      >
        <header className="flex flex-col gap-3 bg-primary/[0.04] px-6 pt-7 pb-6 sm:px-9 sm:pt-9">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">
              {t("from", { school })}
            </p>
            <h1
              id="invitation-title"
              className="font-display text-3xl leading-tight font-semibold text-balance"
            >
              {t("welcome", { name })}
            </h1>
          </div>
          {badges.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
              <span>{t("joinsAs")}</span>
              <ul className="contents">
                {badges.map((b) => (
                  <li key={b}>
                    <Badge variant="secondary">{b}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {account && (
            <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <AccountIcon aria-hidden className="size-4 shrink-0" />
              <span className="truncate">{account}</span>
            </p>
          )}
        </header>
        <SchoolRule />
        <div className="flex flex-col gap-5 px-6 pt-6 pb-7 sm:px-9 sm:pb-9">
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold">{step.title}</h2>
            <p className="text-sm text-muted-foreground">{step.description}</p>
          </div>
          {children}
        </div>
      </article>
      <p className="flex items-center justify-center gap-1.5 text-center text-sm text-muted-foreground">
        <ClockIcon aria-hidden className="size-3.5 shrink-0" />
        {t("validUntil", { date: validUntil })}
      </p>
    </>
  )
}
