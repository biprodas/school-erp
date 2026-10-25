import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { platformResetPassword } from "~/features/platform/auth/actions"
import { AuthCard } from "~/features/auth/components/auth-card"
import { BackToLogin } from "~/features/auth/components/back-to-login"
import { checkToken } from "~/features/auth/server/check-token"
import { LinkProblem } from "~/features/auth/components/link-problem"
import { ResetPasswordForm } from "~/features/auth/components/reset-password-form"
import { param, type SearchParams } from "~/features/auth/search-params"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.reset")
  return { title: t("metaTitle"), robots: { index: false } }
}

/**
 * `/reset-password?token=` on the admin host. The platform reset email
 * links to the apex, which forwards here (`app/site/(account)/reset-password`).
 */
export default async function AdminResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const t = await getTranslations("auth.reset")
  const tf = await getTranslations("auth.forgot")
  const token = await param(searchParams, "token")
  const reset = await checkToken<{ email: string | null }>(
    "/platform/auth/reset-password",
    token
  )

  if (!token || !reset) {
    return (
      <LinkProblem
        title={t("invalidTitle")}
        body={t("invalidBody")}
        action={{ href: "/forgot-password", label: t("requestNew") }}
      >
        <BackToLogin label={tf("backToLogin")} />
      </LinkProblem>
    )
  }

  return (
    <AuthCard
      title={t("title")}
      description={
        reset.email ? t("description", { account: reset.email }) : null
      }
    >
      <ResetPasswordForm
        token={token}
        account={reset.email}
        action={platformResetPassword}
      />
      <BackToLogin label={tf("backToLogin")} />
    </AuthCard>
  )
}
