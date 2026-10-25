import { CircleCheckIcon } from "lucide-react"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { StatusPage } from "~/components/status-page"
import { BRAND } from "~/config/brand-config"
import { requireSchoolSlug } from "~/lib/request-host"
import { getSession } from "~/lib/session"

import { SignOutButton } from "./sign-out-button"

/**
 * Stands in for the staff app (M5), the portal (M8) and onboarding (M7)
 * until they exist, so sign-in lands somewhere real.
 */
export async function SignedInPlaceholder() {
  await requireSchoolSlug()
  const session = await getSession()
  if (!session) redirect("/login")
  const t = await getTranslations("auth.signedIn")
  const user = session.user

  return (
    <StatusPage
      icon={<CircleCheckIcon />}
      title={t("title")}
      description={t("body", {
        name: user.name ?? user.email ?? user.phone ?? "",
        brand: BRAND.name,
      })}
    >
      <SignOutButton />
    </StatusPage>
  )
}
