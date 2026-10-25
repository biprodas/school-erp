import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { AuthCard } from "~/features/auth/auth-card"
import { checkToken } from "~/features/auth/check-token"
import { LinkProblem } from "~/features/auth/link-problem"
import { param, type SearchParams } from "~/features/auth/search-params"
import { VerifyEmailForm } from "~/features/auth/verify-email-form"
import { requireSchoolSlug } from "~/lib/tenancy/request-host"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.verify")
  return { title: t("metaTitle") }
}

/** `/verify-email?token=`: the link in a verification email. */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await requireSchoolSlug()
  const t = await getTranslations("auth.verify")
  const token = await param(searchParams, "token")
  const check = await checkToken<{ email: string | null }>(
    "/auth/verify-email",
    token
  )

  if (!token || !check) {
    return (
      <LinkProblem
        title={t("invalidTitle")}
        body={t("invalidBody")}
        action={{ href: "/login", label: t("continue") }}
      />
    )
  }

  return (
    <AuthCard
      title={t("title")}
      description={
        check.email ? t("description", { email: check.email }) : null
      }
    >
      <VerifyEmailForm token={token} email={check.email} />
    </AuthCard>
  )
}
