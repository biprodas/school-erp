import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { AuthCard } from "~/features/auth/components/auth-card"
import { BackToLogin } from "~/features/auth/components/back-to-login"
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
      <BackToLogin label={t("backToLogin")} />
    </AuthCard>
  )
}
