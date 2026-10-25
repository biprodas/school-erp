import { FileQuestionIcon } from "lucide-react"
import Link from "next/link"
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

/** A 404 inside the staff app keeps the sidebar and header. */
export default async function DashboardNotFound() {
  const t = await getTranslations("shell.notFound")

  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileQuestionIcon />
        </EmptyMedia>
        <EmptyTitle>
          <h1 className="font-display text-2xl font-semibold">{t("title")}</h1>
        </EmptyTitle>
        <EmptyDescription>{t("body")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: "outline" })}
        >
          {t("back")}
        </Link>
      </EmptyContent>
    </Empty>
  )
}
