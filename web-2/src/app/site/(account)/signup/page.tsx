import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { appConfig } from "~/config/app-config"
import { AuthCard } from "~/features/auth/components/auth-card"
import { queryErrorKey } from "~/features/auth/errors"
import { param, type SearchParams } from "~/features/auth/search-params"
import { readGoogleTicket } from "~/features/signup/server/google-ticket"
import { SignupForm } from "~/features/signup/components/signup-form"
import { isGoogleSignInEnabled } from "~/lib/auth/google"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("signup")
  return { title: t("metaTitle") }
}

/**
 * `/signup` on the apex. `?schoolName=` comes from the landing page's
 * form; `?google_ticket=` from "Sign up with Google"; `?error=` from a
 * Google attempt that didn't work.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const t = await getTranslations("signup")
  const google = readGoogleTicket(await param(searchParams, "google_ticket"))
  const googleHref =
    !google && (await isGoogleSignInEnabled()) ? "/signup/google" : null

  return (
    <AuthCard title={t("title")} description={t("description")}>
      <SignupForm
        rootDomain={appConfig.rootDomain}
        initialSchoolName={
          (await param(searchParams, "schoolName"))?.slice(0, 100) ?? ""
        }
        google={google}
        googleHref={googleHref}
        pageError={queryErrorKey(await param(searchParams, "error"))}
      />
    </AuthCard>
  )
}
