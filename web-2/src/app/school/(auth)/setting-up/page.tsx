import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"

import { getSchoolHome, schoolName } from "~/features/school-site/api"
import { AuthCard } from "~/features/auth/components/auth-card"
import { SettingUpActions } from "~/features/auth/components/setting-up-actions"
import { BRAND } from "~/config/brand-config"
import { requireSchoolSlug } from "~/lib/tenancy/request-host"

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
      description={t("body", {
        school: schoolName(home, await getLocale()),
        brand: BRAND.name,
      })}
    >
      <SettingUpActions />
    </AuthCard>
  )
}
