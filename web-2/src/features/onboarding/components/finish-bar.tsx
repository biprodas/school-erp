"use client"

import {
  ArrowRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  PartyPopperIcon,
} from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useActionState } from "react"

import type { OnboardingChecklist } from "~/features/onboarding/api"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Button, buttonVariants } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { cn } from "~/lib/utils"
import { IDLE } from "~/lib/forms/form-state"

import { completeOnboarding, skipOnboarding } from "../actions"
import { missingRequired, visibleSteps } from "../steps"
import { setupCodeKey } from "../use-setup-action"

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
  const to = useTranslations("onboarding")
  const f = useSchoolFormat()
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
        className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
      >
        <p className="flex items-start gap-2 text-sm">
          <CircleCheckIcon
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-primary"
          />
          {t("alreadyOpen")}
        </p>
        <Link href="/dashboard" className={cn(buttonVariants(), "w-full")}>
          {t("toDashboard")}
          <ArrowRightIcon />
        </Link>
      </section>
    )
  }

  const missing = missingRequired(checklist)
  const required = visibleSteps(checklist).filter((s) => s.required)
  const ready = missing.length === 0
  const failed = [completeState, skipState].find((s) => s.status === "error")

  return (
    <section
      aria-label={t("label")}
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors",
        ready && "border-primary/40 bg-primary/5"
      )}
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">
          {to("requiredDone", {
            done: f.number(required.length - missing.length),
            total: f.number(required.length),
          })}
        </span>
        <div aria-hidden className="flex gap-1">
          {required.map((s) => (
            <span
              key={s.key}
              className={cn(
                "h-1 flex-1 rounded-full",
                s.done ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>
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
      <div className="flex flex-col gap-2 max-lg:sm:flex-row-reverse max-lg:sm:justify-between">
        <form action={complete}>
          <Button
            type="submit"
            disabled={pending || !checklist.canComplete}
            className="w-full"
          >
            {completing ? <Spinner /> : <PartyPopperIcon />}
            {t("complete")}
          </Button>
        </form>
        <form action={skip}>
          <Button
            type="submit"
            variant="ghost"
            disabled={pending}
            className="w-full"
          >
            {skipping && <Spinner />}
            {t("skip")}
          </Button>
        </form>
      </div>
      <p className="text-xs text-muted-foreground">{t("skipHint")}</p>
    </section>
  )
}
