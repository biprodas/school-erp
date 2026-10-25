import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { AuthCard } from "~/features/auth/auth-card"
import { ForgotPasswordForm } from "~/features/auth/forgot-password-form"
import { requireSchoolSlug } from "~/lib/request-host"

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
        className="text-sm font-medium underline-offset-4 hover:underline"
      >
        {t("backToLogin")}
      </a>
    </AuthCard>
  )
}
