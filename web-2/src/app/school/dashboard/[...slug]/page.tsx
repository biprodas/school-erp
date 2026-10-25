import { ConstructionIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { buttonVariants } from "~/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import { pageLabel } from "~/lib/nav"

type Props = { params: Promise<{ slug: string[] }> }

async function labelOf(params: Props["params"]) {
  const { slug } = await params
  return pageLabel(`/dashboard/${slug.join("/")}`)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const label = await labelOf(params)
  if (!label) return {}
  const t = await getTranslations("nav.labels")
  return { title: t(label) }
}

/**
 * Sidebar links whose screen isn't built yet: a "Coming soon" page titled
 * from the nav label, so no menu ends on a 404. Paths that aren't in the
 * sidebar are 404s.
 */
export default async function ComingSoonPage({ params }: Props) {
  const label = await labelOf(params)
  if (!label) notFound()
  const t = await getTranslations("nav.labels")
  const ts = await getTranslations("shell.comingSoon")

  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ConstructionIcon />
        </EmptyMedia>
        <EmptyTitle>
          <h1 className="font-display text-2xl font-semibold">{t(label)}</h1>
        </EmptyTitle>
        <EmptyDescription>{ts("body")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: "outline" })}
        >
          {ts("back")}
        </Link>
      </EmptyContent>
    </Empty>
  )
}
