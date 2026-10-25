import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { Welcome } from "~/features/dashboard/welcome"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("dashboard") }
}

// The role dashboards replace the welcome in M6.
export default function DashboardPage() {
  return <Welcome />
}
