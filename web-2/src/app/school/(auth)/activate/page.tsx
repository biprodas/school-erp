import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"

import { getSchoolHome, schoolName } from "~/features/school-site/api"
import { ActivateForm } from "~/features/auth/components/activate-form"
import { AuthCard } from "~/features/auth/components/auth-card"
import { checkToken } from "~/features/auth/server/check-token"
import { LinkProblem } from "~/features/auth/components/link-problem"
import { param, type SearchParams } from "~/features/auth/search-params"
import { requireSchoolSlug } from "~/lib/tenancy/request-host"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.activate")
  return { title: t("metaTitle") }
}

/** `GET /auth/activate` (AuthService.verifyActivation). */
interface Invitation {
  email: string | null
  phone: string | null
  name: string | null
  hasPassword: boolean
}

/** `/activate?token=`: the link in an invitation email. */
export default async function ActivatePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const slug = await requireSchoolSlug()
  const t = await getTranslations("auth.activate")
  const token = await param(searchParams, "token")
  const invitation = await checkToken<Invitation>("/auth/activate", token)

  if (!token || !invitation) {
    return (
      <LinkProblem
        title={t("invalidTitle")}
        body={t("invalidBody")}
        action={{ href: "/login", label: t("signIn") }}
      />
    )
  }

  const account = invitation.email ?? invitation.phone ?? ""
  const school = schoolName(await getSchoolHome(slug), await getLocale())
  return (
    <AuthCard
      title={
        invitation.hasPassword ? t("existingTitle", { school }) : t("title")
      }
      description={
        invitation.hasPassword
          ? t("existingDescription", { account })
          : t("description", { name: invitation.name ?? account, account })
      }
    >
      <ActivateForm token={token} hasPassword={invitation.hasPassword} />
    </AuthCard>
  )
}
