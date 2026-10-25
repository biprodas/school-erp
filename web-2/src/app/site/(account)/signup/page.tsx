import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { AuthCard } from "~/features/auth/auth-card"
import { queryErrorKey } from "~/features/auth/errors"
import { param, type SearchParams } from "~/features/auth/search-params"
import { readGoogleTicket } from "~/features/signup/google-ticket"
import { SignupForm } from "~/features/signup/signup-form"
import { isGoogleSignInEnabled } from "~/lib/google"
import { publicEnv } from "~/lib/public-env"

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
        rootDomain={publicEnv.rootDomain}
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
