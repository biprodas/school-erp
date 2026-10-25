import { ShieldCheckIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { StatusPage } from "~/components/status-page"
import { BRAND } from "~/config/brand-config"

// Placeholder for the platform admin app (M8: sign-in and shell).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin")
  return { title: t("title", { brand: BRAND.name }), robots: { index: false } }
}

export default async function AdminHomePage() {
  const t = await getTranslations("admin")
  return (
    <StatusPage
      icon={<ShieldCheckIcon />}
      title={t("title", { brand: BRAND.name })}
      description={t("body", { brand: BRAND.name })}
    />
  )
}
