import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { appConfig } from "~/config/app-config"
import { queryErrorKey } from "~/features/auth/errors"
import { param, type SearchParams } from "~/features/auth/search-params"
import { readGoogleTicket } from "~/features/signup/server/google-ticket"
import { AccountPanel } from "~/features/signup/components/account-panel"
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
    <>
      <AccountPanel title={t("title")} description={t("description")}>
        <SignupForm
          rootDomain={appConfig.rootDomain}
          initialSchoolName={
            (await param(searchParams, "schoolName"))?.slice(0, 100) ?? ""
          }
          google={google}
          googleHref={googleHref}
          pageError={queryErrorKey(await param(searchParams, "error"))}
        />
      </AccountPanel>
      <p className="text-center text-sm text-balance text-muted-foreground">
        {t.rich("agree", {
          terms: (chunks) => <LegalLink href="/terms">{chunks}</LegalLink>,
          privacy: (chunks) => <LegalLink href="/privacy">{chunks}</LegalLink>,
        })}
      </p>
      {/* Wider screens have this in the header. */}
      <p className="text-center text-sm text-muted-foreground sm:hidden">
        {t("haveSchool")}{" "}
        <a
          href="/find-school"
          className="rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          {t("findSchool")}
        </a>
      </p>
    </>
  )
}

/** Opens in a new tab, so a half-filled form isn't lost. */
function LegalLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="rounded-sm text-foreground underline underline-offset-4 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/30"
    >
      {children}
    </a>
  )
}
