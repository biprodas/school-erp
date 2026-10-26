"use client"

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  FlagIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  MinusIcon,
  PartyPopperIcon,
  UsersIcon,
} from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useActionState, useEffect, useId, useRef } from "react"

import type {
  OnboardingChecklist,
  OnboardingStep,
  OnboardingStepKey,
} from "~/features/onboarding/api"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Button, buttonVariants } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { cn } from "~/lib/utils"
import { IDLE } from "~/lib/forms/form-state"

import { completeOnboarding, skipOnboarding } from "../actions"
import { StepDetail } from "./finish-details"
import { missingRequired, visibleSteps } from "../steps"
import { setupCodeKey } from "../use-setup-action"

/** What the wizard shows: a step, or the last page that finishes setup. */
export type WizardView = OnboardingStepKey | "finish"

/** Once setup is finished: it says so, and leads to the dashboard. */
function AlreadyOpen({ className }: { className?: string }) {
  const t = useTranslations("onboarding.finish")
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p className="flex items-start gap-2 text-sm">
        <CircleCheckIcon
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-primary"
        />
        {t("alreadyOpen")}
      </p>
      <Link
        href="/dashboard"
        className={cn(buttonVariants(), "self-start max-sm:w-full")}
      >
        {t("toDashboard")}
        <ArrowRightIcon />
      </Link>
    </div>
  )
}

/**
 * The progress card beside the steps: how many required steps are done
 * and the way on: the next required step still open (past the one in
 * front of them), or the last page, where setup is finished or skipped.
 * It submits nothing itself.
 */
export function FinishCard({
  checklist,
  current,
  onGoTo,
}: {
  checklist: OnboardingChecklist
  current: WizardView | null
  onGoTo: (view: WizardView) => void
}) {
  const t = useTranslations("onboarding.finish")
  const ts = useTranslations("onboarding.steps")
  const to = useTranslations("onboarding")
  const f = useSchoolFormat()

  if (checklist.completedAt) {
    return (
      <section
        aria-label={t("label")}
        className="rounded-xl border border-primary/30 bg-primary/5 p-4"
      >
        <AlreadyOpen />
      </section>
    )
  }

  const missing = missingRequired(checklist)
  const required = visibleSteps(checklist).filter((s) => s.required)
  const ready = missing.length === 0
  // The open step is already in front of them; point to the one after.
  const next = missing.find((s) => s.key !== current)

  return (
    <section
      aria-label={t("label")}
      className={cn(
        "flex flex-col gap-4 rounded-xl border bg-card p-4",
        ready && "border-primary/40 bg-primary/5"
      )}
    >
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          {ready && (
            <PartyPopperIcon aria-hidden className="size-4 text-primary" />
          )}
          {ready ? t("readyTitle") : t("label")}
        </span>
        <RequiredBar checklist={checklist} />
        <span className="text-xs text-muted-foreground">
          {ready
            ? t("ready")
            : to("requiredDone", {
                done: f.number(required.length - missing.length),
                total: f.number(required.length),
              })}
        </span>
      </div>
      {!ready && next ? (
        <Button
          variant="outline"
          className="w-full justify-between"
          onClick={() => onGoTo(next.key)}
        >
          <span className="truncate">
            {t("next", { step: ts(`${next.key}.title`) })}
          </span>
          <ArrowRightIcon aria-hidden />
        </Button>
      ) : (
        <Button
          variant={ready ? "default" : "outline"}
          className="w-full justify-between"
          onClick={() => onGoTo("finish")}
        >
          {t("review")}
          <ArrowRightIcon aria-hidden />
        </Button>
      )}
    </section>
  )
}

/** One segment per required step, done ones in the school's color. */
function RequiredBar({ checklist }: { checklist: OnboardingChecklist }) {
  const required = visibleSteps(checklist).filter((s) => s.required)
  return (
    <div aria-hidden className="flex gap-1">
      {required.map((s) => (
        <span
          key={s.key}
          className={cn(
            "h-1.5 flex-1 rounded-full",
            s.done ? "bg-primary" : "bg-muted"
          )}
        />
      ))}
    </div>
  )
}

/** A heading in the left column on wide screens, ruled off from the last. */
function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t pt-6 first:border-t-0 first:pt-0 lg:flex">
      <div className="mb-3 flex flex-col gap-0.5 lg:mb-0 lg:w-44 lg:shrink-0 lg:pr-6">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  )
}

/**
 * Steps with where they stand: a done one says what it set up, one not
 * done says so and opens it.
 */
function StepList({
  label,
  steps,
  onGoTo,
}: {
  label: string
  steps: OnboardingStep[]
  onGoTo: (view: WizardView) => void
}) {
  const t = useTranslations("onboarding.finish")
  const ts = useTranslations("onboarding.steps")
  return (
    <ul className="flex flex-col divide-y rounded-lg border" aria-label={label}>
      {steps.map((step) => (
        <li key={step.key} className="flex items-center gap-3 px-3 py-2.5">
          <span
            aria-hidden
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full",
              step.done
                ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                : step.required
                  ? "bg-highlight/25 text-highlight-foreground dark:text-highlight"
                  : "bg-muted text-muted-foreground"
            )}
          >
            {step.done ? (
              <CheckIcon className="size-3.5" strokeWidth={3} />
            ) : step.required ? (
              <CircleAlertIcon className="size-3.5" />
            ) : (
              <MinusIcon className="size-3.5" />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">
              {ts(`${step.key}.title`)}
            </span>
            {step.done ? (
              <>
                <span className="sr-only">{t("statusDone")}</span>
                <StepDetail step={step.key} />
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                {step.required ? t("statusOpen") : t("statusSkipped")}
              </span>
            )}
          </span>
          {!step.done && (
            <Button
              variant="ghost"
              size="sm"
              aria-label={t("goTo", { step: ts(`${step.key}.title`) })}
              onClick={() => onGoTo(step.key)}
            >
              {t("open")}
              <ArrowRightIcon aria-hidden />
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * The last page: the required and optional steps with what each set up
 * (a way back to any not done), then opening the school: what follows and
 * "Finish setup" once the required steps are done, or "Skip for now"
 * while they aren't. Both are server actions: they open the
 * school, update the session and go to \`/dashboard\`.
 */
export function FinishPanel({
  checklist,
  focusOnMount,
  onBack,
  onGoTo,
  className,
}: {
  checklist: OnboardingChecklist
  focusOnMount: boolean
  onBack: () => void
  onGoTo: (view: WizardView) => void
  className?: string
}) {
  const t = useTranslations("onboarding.finish")
  const to = useTranslations("onboarding")
  const te = useTranslations("onboarding.errors")
  const f = useSchoolFormat()
  const headingId = useId()
  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [completeState, complete, completing] = useActionState(
    completeOnboarding,
    IDLE
  )
  const [skipState, skip, skipping] = useActionState(skipOnboarding, IDLE)
  const pending = completing || skipping

  // As a step panel does: focus its heading when someone moves here.
  useEffect(() => {
    const section = sectionRef.current
    if (!focusOnMount || !section) return
    headingRef.current?.focus({ preventScroll: true })
    if (section.getBoundingClientRect().top < 80) {
      section.scrollIntoView?.({ behavior: "smooth", block: "start" })
    }
  }, [focusOnMount])

  const steps = visibleSteps(checklist)
  const missing = missingRequired(checklist)
  const required = steps.filter((s) => s.required)
  const ready = missing.length === 0
  const failed = [completeState, skipState].find((s) => s.status === "error")

  return (
    <section
      ref={sectionRef}
      aria-labelledby={headingId}
      className={cn(
        "flex animate-in scroll-mt-24 flex-col self-start rounded-xl border bg-card shadow-xs duration-200 fade-in-0 slide-in-from-bottom-1",
        className
      )}
    >
      <div className="flex items-start gap-4 border-b p-5 sm:p-6">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary max-sm:hidden"
        >
          <FlagIcon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">
            {t("lastStep")}
          </p>
          <h2
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
            className="text-lg font-semibold tracking-tight outline-none sm:text-xl"
          >
            {t("reviewTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("reviewSummary")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-6 p-5 sm:p-6">
        {checklist.completedAt ? (
          <AlreadyOpen />
        ) : (
          <>
            <Section title={t("requiredTitle")} hint={t("requiredHint")}>
              <StepList
                label={t("requiredLabel")}
                steps={steps.filter((s) => s.required)}
                onGoTo={onGoTo}
              />
            </Section>
            <Section title={t("optionalTitle")} hint={t("optionalHint")}>
              <StepList
                label={t("optionalLabel")}
                steps={steps.filter((s) => !s.required)}
                onGoTo={onGoTo}
              />
            </Section>

            <Section title={t("openTitle")} hint={t("openHint")}>
              <div className="flex flex-col gap-4">
                {failed?.status === "error" && (
                  <Alert variant="destructive" aria-live="polite">
                    <CircleAlertIcon />
                    <AlertDescription>
                      {te(setupCodeKey(failed.code))}
                    </AlertDescription>
                  </Alert>
                )}
                {ready ? (
                  <div className="flex flex-col gap-4 rounded-lg border border-primary/40 bg-primary/5 p-4">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <PartyPopperIcon
                        aria-hidden
                        className="size-4 text-primary"
                      />
                      {t("readyTitle")}
                    </span>
                    <ul className="flex flex-col gap-2 text-sm">
                      {(
                        [
                          [UsersIcon, t("afterStaff")],
                          [LayoutDashboardIcon, t("afterDashboard")],
                          [ListChecksIcon, t("afterLater")],
                        ] as const
                      ).map(([Icon, text]) => (
                        <li key={text} className="flex items-start gap-2">
                          <Icon
                            aria-hidden
                            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                          />
                          {text}
                        </li>
                      ))}
                    </ul>
                    <form action={complete}>
                      <Button
                        type="submit"
                        size="lg"
                        disabled={pending}
                        className="max-sm:w-full"
                      >
                        {completing ? <Spinner /> : <PartyPopperIcon />}
                        {t("complete")}
                      </Button>
                    </form>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 rounded-lg border p-4">
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-semibold">
                        {to("requiredDone", {
                          done: f.number(required.length - missing.length),
                          total: f.number(required.length),
                        })}
                      </span>
                      <RequiredBar checklist={checklist} />
                      <span className="text-sm text-muted-foreground">
                        {t("notReady")}
                      </span>
                    </div>
                    <form action={skip}>
                      <Button
                        type="submit"
                        variant="outline"
                        disabled={pending}
                        className="max-sm:w-full"
                      >
                        {skipping && <Spinner />}
                        {t("skip")}
                      </Button>
                    </form>
                    <p className="text-xs text-muted-foreground">
                      {t("skipHint")}
                    </p>
                  </div>
                )}
              </div>
            </Section>
          </>
        )}
      </div>

      <div className="mt-auto flex items-center rounded-b-xl border-t px-5 py-3 sm:px-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeftIcon />
          {to("back")}
        </Button>
      </div>
    </section>
  )
}
