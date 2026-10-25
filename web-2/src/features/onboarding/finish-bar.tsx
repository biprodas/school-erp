"use client"

import { ArrowRightIcon, CircleAlertIcon, PartyPopperIcon } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useActionState } from "react"

import type { OnboardingChecklist } from "~/api/onboarding"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Button, buttonVariants } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { IDLE } from "~/lib/forms/form-state"

import { completeOnboarding, skipOnboarding } from "./actions"
import { missingRequired } from "./steps"
import { setupCodeKey } from "./use-setup-action"

/**
 * "Finish setup" once every required step is done, and "Skip for now".
 * Both are server actions: they open the school, update the session and
 * go to `/dashboard`. After that (from the dashboard banner) it only links
 * back to the dashboard.
 */
export function FinishBar({ checklist }: { checklist: OnboardingChecklist }) {
  const t = useTranslations("onboarding.finish")
  const te = useTranslations("onboarding.errors")
  const ts = useTranslations("onboarding.steps")
  const [completeState, complete, completing] = useActionState(
    completeOnboarding,
    IDLE
  )
  const [skipState, skip, skipping] = useActionState(skipOnboarding, IDLE)
  const pending = completing || skipping

  if (checklist.completedAt) {
    return (
      <section
        aria-label={t("label")}
        className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="text-sm">{t("alreadyOpen")}</p>
        <Link href="/dashboard" className={buttonVariants()}>
          {t("toDashboard")}
          <ArrowRightIcon />
        </Link>
      </section>
    )
  }

  const missing = missingRequired(checklist)
  const failed = [completeState, skipState].find((s) => s.status === "error")

  return (
    <section
      aria-label={t("label")}
      className="flex flex-col gap-4 rounded-xl border bg-card p-4"
    >
      <p className="text-sm text-muted-foreground">
        {missing.length
          ? t("missing", {
              steps: missing.map((s) => ts(`${s.key}.title`)).join(", "),
            })
          : t("ready")}
      </p>
      {failed?.status === "error" && (
        <Alert variant="destructive" aria-live="polite">
          <CircleAlertIcon />
          <AlertDescription>{te(setupCodeKey(failed.code))}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <form action={skip}>
          <Button
            type="submit"
            variant="ghost"
            disabled={pending}
            className="max-sm:w-full"
          >
            {skipping && <Spinner />}
            {t("skip")}
          </Button>
        </form>
        <form action={complete}>
          <Button
            type="submit"
            disabled={pending || !checklist.canComplete}
            className="max-sm:w-full"
          >
            {completing ? <Spinner /> : <PartyPopperIcon />}
            {t("complete")}
          </Button>
        </form>
      </div>
      <p className="text-xs text-muted-foreground">{t("skipHint")}</p>
    </section>
  )
}
