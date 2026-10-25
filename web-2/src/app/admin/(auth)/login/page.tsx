import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { platformSignIn } from "~/features/platform/auth/actions"
import { AuthCard } from "~/features/auth/components/auth-card"
import { queryErrorKey } from "~/features/auth/errors"
import { LoginForm } from "~/features/auth/components/login-form"
import { param, type SearchParams } from "~/features/auth/search-params"
import { isGoogleSignInEnabled } from "~/lib/auth/google"
import { safeNext } from "~/lib/security/safe-next"

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
  const tl = await getTranslations("auth.login")
  const next = safeNext(await param(searchParams, "next"), "") || null
  const notice =
    (await param(searchParams, "notice")) === "password-reset"
      ? tl("passwordReset")
      : null
  const googleHref = (await isGoogleSignInEnabled())
    ? `/auth/google${next ? `?next=${encodeURIComponent(next)}` : ""}`
    : null

  return (
    <div className="flex flex-col gap-5">
      <AuthCard title={t("title")} description={t("description")}>
        <LoginForm
          next={next}
          googleHref={googleHref}
          pageError={queryErrorKey(await param(searchParams, "error"))}
          notice={notice}
          action={platformSignIn}
          schoolLinks={false}
          emailOnly
        />
      </AuthCard>
      {/* School staff land here by mistake; their sign-in is on the school's host. */}
      <p className="text-center text-sm text-balance text-muted-foreground">
        {t("schoolNote")}
      </p>
    </div>
  )
}
