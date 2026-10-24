import { ShieldCheckIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { StatusPage } from "~/components/status-page"

// Placeholder for the platform admin app (M8: sign-in and shell).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin")
  return { title: t("title"), robots: { index: false } }
}

export default async function AdminHomePage() {
  const t = await getTranslations("admin")
  return (
    <StatusPage
      icon={<ShieldCheckIcon />}
      title={t("title")}
      description={t("body")}
    />
  )
}
