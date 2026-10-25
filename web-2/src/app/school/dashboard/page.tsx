import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { HomeDashboard } from "~/features/dashboard/home-dashboard"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("dashboard") }
}

/** The role-aware home: dashboard groups by permission (M6). */
export default function DashboardPage() {
  return <HomeDashboard />
}
