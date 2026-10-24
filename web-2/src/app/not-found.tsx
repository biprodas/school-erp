import { FileQuestionIcon, SchoolIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { StatusPage } from "~/components/status-page"
import { buttonVariants } from "~/components/ui/button"
import { getRequestHost, siteUrl } from "~/lib/request-host"

/**
 * Every 404. On a host we don't serve (`src/proxy.ts` marks it `unknown`:
 * an unknown or reserved slug, an inactive custom domain) it says the
 * school wasn't found and points to "Find your school"; elsewhere it is a
 * plain "page not found".
 */
export default async function NotFound() {
  const { kind } = await getRequestHost()

  if (kind === "unknown") {
    const t = await getTranslations("unknownSchool")
    const findSchool = await siteUrl("/find-school")
    return (
      <StatusPage
        icon={<SchoolIcon />}
        title={t("title")}
        description={t("body")}
      >
        <a href={findSchool} className={buttonVariants({ size: "lg" })}>
          {t("findSchool")}
        </a>
      </StatusPage>
    )
  }

  const t = await getTranslations("notFound")
  return (
    <StatusPage
      icon={<FileQuestionIcon />}
      title={t("title")}
      description={t("body")}
    >
      <a href="/" className={buttonVariants({ size: "lg" })}>
        {t("home")}
      </a>
    </StatusPage>
  )
}
