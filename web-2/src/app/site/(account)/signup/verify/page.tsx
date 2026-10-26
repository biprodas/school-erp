import { MailCheckIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { appConfig } from "~/config/app-config"
import { LinkProblem } from "~/features/auth/components/link-problem"
import { param, type SearchParams } from "~/features/auth/search-params"
import type { SignupPreview } from "~/features/signup/api"
import { AccountPanel } from "~/features/signup/components/account-panel"
import { VerifySignupForm } from "~/features/signup/components/verify-signup-form"
import { isApiError } from "~/lib/api/errors"
import { backendFetch } from "~/lib/api/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("signup")
  return { title: t("verifyMetaTitle") }
}

/**
 * `/signup/verify?token=`: the link in the signup email. Shows what the
 * link will create (looking doesn't use it, so mail scanners that open
 * links do no harm), and the school is created only when the button is
 * pressed.
 */
export default async function VerifySignupPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const t = await getTranslations("signup")
  const token = await param(searchParams, "token")
  const preview = token ? await readPreview(token) : null

  if (!token || !preview) {
    return (
      <LinkProblem
        title={t("invalidTitle")}
        body={t("invalidBody")}
        action={{ href: "/signup", label: t("startAgain") }}
      />
    )
  }

  return (
    <AccountPanel
      eyebrow={
        <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
          <MailCheckIcon className="size-4" aria-hidden="true" />
          {t("verify.emailVerified")}
        </p>
      }
      title={t("verify.title")}
      description={t("verify.description")}
    >
      <VerifySignupForm
        token={token}
        preview={preview}
        rootDomain={appConfig.rootDomain}
      />
    </AccountPanel>
  )
}

/** The link's signup, or null when it is unknown, used or expired. */
async function readPreview(token: string): Promise<SignupPreview | null> {
  try {
    return await backendFetch<SignupPreview>("/public/signup/preview", {
      method: "POST",
      session: null,
      body: { token },
    })
  } catch (error) {
    if (isApiError(error) && error.status === 400) return null
    throw error
  }
}
