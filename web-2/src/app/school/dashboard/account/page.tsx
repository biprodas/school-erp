import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { AccountView } from "~/features/account/components/account-view"
import { queryErrorKey } from "~/features/auth/errors"
import { param, type SearchParams } from "~/features/auth/search-params"
import { isGoogleSignInEnabled } from "~/lib/auth/google"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("account") }
}

/** `/dashboard/account`: profile, password, sessions, Google sign-in. */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const t = await getTranslations("shell.account")
  const te = await getTranslations("authErrors")
  const [googleEnabled, linked, googleError] = await Promise.all([
    isGoogleSignInEnabled(),
    param(searchParams, "google"),
    param(searchParams, "google_error"),
  ])

  // Back from Google (`GoogleAuthService.completeLink` / `failure`).
  const errorKey = googleError
    ? (queryErrorKey(googleError) ?? "googleFailed")
    : null
  const notice = errorKey
    ? { type: "error" as const, message: te(errorKey) }
    : linked === "linked"
      ? { type: "success" as const, message: t("googleLinkedNotice") }
      : null

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <AccountView googleEnabled={googleEnabled} notice={notice} />
    </>
  )
}
