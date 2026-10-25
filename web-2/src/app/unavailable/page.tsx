import { CloudOffIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { StatusPage } from "~/components/status-page"
import { buttonVariants } from "~/components/ui/button"
import { getRequestHost } from "~/lib/tenancy/request-host"

// `src/proxy.ts` rewrites here when the backend can't say which school a
// host belongs to; the lookup isn't cached, so a reload retries it.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("unavailable")
  return { title: t("metaTitle"), robots: { index: false } }
}

export default async function UnavailablePage() {
  const t = await getTranslations("unavailable")
  const { origin } = await getRequestHost()

  return (
    <StatusPage
      icon={<CloudOffIcon />}
      title={t("title")}
      description={t("body")}
    >
      <a href={origin} className={buttonVariants({ size: "lg" })}>
        {t("retry")}
      </a>
    </StatusPage>
  )
}
