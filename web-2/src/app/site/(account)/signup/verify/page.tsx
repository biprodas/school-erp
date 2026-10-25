import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { AuthCard } from "~/features/auth/auth-card"
import { LinkProblem } from "~/features/auth/link-problem"
import { param, type SearchParams } from "~/features/auth/search-params"
import { VerifySignupForm } from "~/features/signup/verify-signup-form"
import { publicEnv } from "~/lib/public-env"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("signup")
  return { title: t("verifyMetaTitle") }
}

/**
 * `/signup/verify?token=`: the link in the signup email. The backend has
 * no check without using the link, so an unknown or used one shows up when
 * the button is pressed.
 */
export default async function VerifySignupPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const t = await getTranslations("signup")
  const token = await param(searchParams, "token")

  if (!token) {
    return (
      <LinkProblem
        title={t("invalidTitle")}
        body={t("invalidBody")}
        action={{ href: "/signup", label: t("startAgain") }}
      />
    )
  }

  return (
    <AuthCard title={t("verifyTitle")} description={t("verifyDescription")}>
      <VerifySignupForm token={token} rootDomain={publicEnv.rootDomain} />
    </AuthCard>
  )
}
