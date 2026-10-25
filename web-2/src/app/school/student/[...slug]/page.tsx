import { ConstructionIcon } from "lucide-react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import { PORTAL_NAV } from "~/features/portal/portal-nav"

type Props = { params: Promise<{ slug: string[] }> }

async function itemOf(params: Props["params"]) {
  const { slug } = await params
  const path = `/student/${slug.join("/")}`
  return PORTAL_NAV.find((item) => item.href === path) ?? null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = await itemOf(params)
  if (!item) return {}
  const t = await getTranslations("portal.nav")
  return { title: t(item.id) }
}

/**
 * Portal sections not built yet: "Coming soon", titled from the bottom
 * bar's label. Other paths are 404s.
 */
export default async function PortalComingSoonPage({ params }: Props) {
  const item = await itemOf(params)
  if (!item) notFound()
  const t = await getTranslations("portal")

  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ConstructionIcon />
        </EmptyMedia>
        <EmptyTitle>
          <h1 className="font-display text-2xl font-semibold">
            {t(`nav.${item.id}`)}
          </h1>
        </EmptyTitle>
        <EmptyDescription>{t("comingSoon")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
