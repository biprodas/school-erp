"use client"

import { useQuery } from "@tanstack/react-query"
import { RocketIcon } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"

import { onboardingChecklistQuery } from "~/api/onboarding"
import { buttonVariants } from "~/components/ui/button"
import { Progress } from "~/components/ui/progress"
import { useSchoolFormat } from "~/hooks/use-school-format"

/**
 * For members who run onboarding, while the checklist is below 100 %
 * (onboarding may have been skipped). Says nothing when it can't load:
 * it is a nudge, not information anyone depends on.
 */
export function OnboardingBanner() {
  const t = useTranslations("dashboard.onboarding")
  const f = useSchoolFormat()
  const { data } = useQuery(onboardingChecklistQuery())
  if (!data || data.percentage >= 100) return null

  return (
    <section
      aria-label={t("title")}
      className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:gap-4"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5">
        <RocketIcon aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="font-medium">{t("title")}</p>
          <p className="text-sm text-muted-foreground">
            {t("body", { percentage: f.number(data.percentage) })}
          </p>
        </div>
        <Progress
          value={data.percentage}
          aria-label={t("progress")}
          className="max-w-sm"
        />
      </div>
      <Link href="/onboarding" className={buttonVariants()}>
        {t("action")}
      </Link>
    </section>
  )
}
