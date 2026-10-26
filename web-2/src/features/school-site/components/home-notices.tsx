import { PinIcon } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"

import { Badge } from "~/components/ui/badge"
import { dateOptionsFor, formatDate } from "~/lib/format"
import type { SchoolHome } from "../api"
import { HomeHeading } from "./home-section"

type Notice = NonNullable<SchoolHome["notices"]>[number]

/** The school's public notices, pinned first, then newest. */
export async function HomeNotices({ notices }: { notices: Notice[] }) {
  const t = await getTranslations("schoolHome")
  const locale = await getLocale()

  return (
    <section
      id="notices"
      aria-labelledby="notices-title"
      className="flex scroll-mt-20 flex-col gap-6"
    >
      <HomeHeading id="notices">{t("notices")}</HomeHeading>
      <ul className="flex flex-col gap-3">
        {notices.map((notice) => (
          <li key={notice.id}>
            <article className="flex flex-col gap-2 rounded-xl border bg-card p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {notice.publishAt && (
                  <time
                    dateTime={notice.publishAt}
                    className="text-sm font-medium text-primary"
                  >
                    {formatDate(notice.publishAt, {
                      format: "D MMM YYYY",
                      ...dateOptionsFor(locale),
                    })}
                  </time>
                )}
                {notice.pinned && (
                  <Badge variant="secondary">
                    <PinIcon aria-hidden="true" />
                    {t("pinned")}
                  </Badge>
                )}
              </div>
              <h3 className="text-lg font-semibold text-balance">
                {notice.title}
              </h3>
              <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                {notice.body}
              </p>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
