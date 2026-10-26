import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { HomePageEditor } from "~/features/settings/components/home-page-editor"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("homePage") }
}

/** `/dashboard/settings/home-page`: the school's public home page. */
export default async function HomePageSettingsPage() {
  const t = await getTranslations("settings.homePage")

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <HomePageEditor />
    </>
  )
}
