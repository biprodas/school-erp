import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"

import { getSchoolHome, schoolName } from "~/api/public/school-home"
import { AuthCard } from "~/features/auth/auth-card"
import { queryErrorKey } from "~/features/auth/errors"
import { LoginForm } from "~/features/auth/login-form"
import { param, type SearchParams } from "~/features/auth/search-params"
import { isGoogleSignInEnabled } from "~/lib/google"
import { requireSchoolSlug } from "~/lib/request-host"
import { safeNext } from "~/lib/safe-next"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login")
  return { title: t("metaTitle") }
}

/**
 * `/login` on a school host. Signed-in users never see it: `src/proxy.ts`
 * sends them home. `?next=` (same-host path) is where they go after
 * signing in; `?error=` comes from the handoff route and Google.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const home = await getSchoolHome(await requireSchoolSlug())
  const t = await getTranslations("auth.login")
  const next = safeNext(await param(searchParams, "next"), "") || null
  const notice =
    (await param(searchParams, "notice")) === "password-reset"
      ? t("passwordReset")
      : null
  const googleHref = (await isGoogleSignInEnabled())
    ? `/auth/google${next ? `?next=${encodeURIComponent(next)}` : ""}`
    : null

  return (
    <AuthCard
      title={t("title")}
      description={t("description", {
        school: schoolName(home, await getLocale()),
      })}
    >
      <LoginForm
        next={next}
        googleHref={googleHref}
        pageError={queryErrorKey(await param(searchParams, "error"))}
        notice={notice}
      />
    </AuthCard>
  )
}
