import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { platformSignIn } from "~/features/admin/actions"
import { AuthCard } from "~/features/auth/auth-card"
import { queryErrorKey } from "~/features/auth/errors"
import { LoginForm } from "~/features/auth/login-form"
import { param, type SearchParams } from "~/features/auth/search-params"
import { isGoogleSignInEnabled } from "~/lib/google"
import { safeNext } from "~/lib/safe-next"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.login")
  return { title: t("metaTitle"), robots: { index: false } }
}

/**
 * `/login` on the admin host (platform realm). Signed-in admins never see
 * it: the proxy sends them to `/`.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const t = await getTranslations("admin.login")
  const next = safeNext(await param(searchParams, "next"), "") || null
  const googleHref = (await isGoogleSignInEnabled())
    ? `/auth/google${next ? `?next=${encodeURIComponent(next)}` : ""}`
    : null

  return (
    <AuthCard title={t("title")} description={t("description")}>
      <LoginForm
        next={next}
        googleHref={googleHref}
        pageError={queryErrorKey(await param(searchParams, "error"))}
        notice={null}
        action={platformSignIn}
        schoolLinks={false}
      />
    </AuthCard>
  )
}
