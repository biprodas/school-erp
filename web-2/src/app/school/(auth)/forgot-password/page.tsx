import { ArrowLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { AuthCard } from "~/features/auth/components/auth-card"
import { ForgotPasswordForm } from "~/features/auth/components/forgot-password-form"
import { requireSchoolSlug } from "~/lib/tenancy/request-host"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.forgot")
  return { title: t("metaTitle") }
}

/** `/forgot-password`: emails a reset link to a member of this school. */
export default async function ForgotPasswordPage() {
  await requireSchoolSlug()
  const t = await getTranslations("auth.forgot")

  return (
    <AuthCard title={t("title")} description={t("description")}>
      <ForgotPasswordForm />
      <a
        href="/login"
        className="inline-flex items-center gap-1.5 self-center rounded-sm text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        {t("backToLogin")}
      </a>
    </AuthCard>
  )
}
