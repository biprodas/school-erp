import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { buttonVariants } from "~/components/ui/button"
import { AuthCard } from "~/features/auth/components/auth-card"
import { ChangePasswordForm } from "~/features/auth/components/change-password-form"
import { param, type SearchParams } from "~/features/auth/search-params"
import { SignOutButton } from "~/features/auth/components/sign-out-button"
import { requireSchoolSlug } from "~/lib/tenancy/request-host"
import { safeNext } from "~/lib/security/safe-next"
import { getSession } from "~/lib/auth"
import { homeFor } from "~/lib/auth/home"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.changePassword")
  return { title: t("metaTitle") }
}

/**
 * `/change-password`: forced after a temporary password (the proxy keeps
 * the user here until it is done, so the only way out is signing out), or
 * chosen from the account menu.
 */
export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await requireSchoolSlug()
  const session = await getSession()
  if (!session) redirect("/login?next=/change-password")

  const t = await getTranslations("auth.changePassword")
  const forced = session.mustChangePassword
  const next = safeNext(await param(searchParams, "next"), "") || null

  return (
    <AuthCard
      title={t("title")}
      description={t(forced ? "forcedDescription" : "description")}
    >
      <ChangePasswordForm
        forced={forced}
        account={session.user.email ?? session.user.phone}
        next={next}
      />
      {forced ? (
        <SignOutButton variant="ghost" />
      ) : (
        <a
          href={next ?? homeFor(session)}
          className={buttonVariants({ variant: "ghost", size: "lg" })}
        >
          {t("cancel")}
        </a>
      )}
    </AuthCard>
  )
}
