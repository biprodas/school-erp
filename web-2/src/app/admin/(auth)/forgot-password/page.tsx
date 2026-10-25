import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { platformRequestPasswordReset } from "~/features/platform/auth/actions"
import { AuthCard } from "~/features/auth/components/auth-card"
import { BackToLogin } from "~/features/auth/components/back-to-login"
import { ForgotPasswordForm } from "~/features/auth/components/forgot-password-form"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.forgot")
  return { title: t("metaTitle"), robots: { index: false } }
}

/** `/forgot-password` on the admin host: emails a platform reset link. */
export default async function AdminForgotPasswordPage() {
  const t = await getTranslations("auth.forgot")

  return (
    <AuthCard title={t("title")} description={t("description")}>
      <ForgotPasswordForm action={platformRequestPasswordReset} host="admin" />
      <BackToLogin label={t("backToLogin")} />
    </AuthCard>
  )
}
