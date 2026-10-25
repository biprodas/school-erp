import {
  BuildingIcon,
  HistoryIcon,
  PackageIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { Badge } from "~/components/ui/badge"
import { BRAND } from "~/config/brand-config"
import { getSession } from "~/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin")
  return { title: t("title", { brand: BRAND.name }), robots: { index: false } }
}

const AREAS: {
  id: "schools" | "plans" | "users" | "audit"
  icon: LucideIcon
}[] = [
  { id: "schools", icon: BuildingIcon },
  { id: "plans", icon: PackageIcon },
  { id: "users", icon: UsersIcon },
  { id: "audit", icon: HistoryIcon },
]

/**
 * The console's home: a placeholder until the platform screens (a later
 * slice) exist, saying what will be here.
 */
export default async function AdminHomePage() {
  const t = await getTranslations("admin.home")
  const session = await getSession()
  const name = session?.user.name ?? session?.user.email ?? ""

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {t("title", { name })}
        </h1>
        <p className="text-muted-foreground">
          {t("body", { brand: BRAND.name })}
        </p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2">
        {AREAS.map(({ id, icon: Icon }) => (
          <li
            key={id}
            className="flex items-start gap-3 rounded-xl border bg-card p-4"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4.5">
              <Icon aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2 font-medium">
                {t(`areas.${id}.title`)}
                <Badge variant="outline">{t("soon")}</Badge>
              </span>
              <span className="text-sm text-muted-foreground">
                {t(`areas.${id}.body`)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
