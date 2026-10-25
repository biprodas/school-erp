import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"

import { getSchoolHome, schoolName } from "~/api/public/school-home"
import { AuthCard } from "~/features/auth/auth-card"
import { SettingUpActions } from "~/features/auth/setting-up-actions"
import { requireSchoolSlug } from "~/lib/request-host"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.settingUp")
  return { title: t("metaTitle") }
}

/**
 * `/setting-up`: where staff wait while the school's admins finish
 * onboarding (the proxy sends them here, and away once it is done).
 */
export default async function SettingUpPage() {
  const home = await getSchoolHome(await requireSchoolSlug())
  const t = await getTranslations("auth.settingUp")

  return (
    <AuthCard
      title={t("title")}
      description={t("body", { school: schoolName(home, await getLocale()) })}
    >
      <SettingUpActions />
    </AuthCard>
  )
}
