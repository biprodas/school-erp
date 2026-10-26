"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  AwardIcon,
  BookOpenIcon,
  CalendarRangeIcon,
  CheckIcon,
  FlagIcon,
  LayersIcon,
  ReceiptIcon,
  SchoolIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useId, useRef, useState } from "react"

import {
  onboardingChecklistQuery,
  onboardingKeys,
  type OnboardingChecklist,
  type OnboardingStep,
  type OnboardingStepKey,
} from "~/features/onboarding/api"
import { Button } from "~/components/ui/button"
import { Skeleton } from "~/components/ui/skeleton"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { cn } from "~/lib/utils"

import { ClassesStep } from "./classes-step"
import { CurriculumStep } from "./curriculum-step"
import { FeesStep } from "./fees-step"
import { FinishCard, FinishPanel, type WizardView } from "./finish-bar"
import { GradingStep } from "./grading-step"
import { ProfileStep } from "./profile-step"
import { SessionStep } from "./session-step"
import { StaffStep } from "./staff-step"
import { StepLoadFailed } from "./step-parts"
import { firstOpenStep, nextOpenStep, visibleSteps } from "../steps"

const STEP_ICONS: Record<OnboardingStepKey, LucideIcon> = {
  profile: SchoolIcon,
  session: CalendarRangeIcon,
  classes: LayersIcon,
  curriculum: BookOpenIcon,
  grading: AwardIcon,
  fees: ReceiptIcon,
  staff: UsersIcon,
}

/**
 * `/onboarding` (doc/frontend-implementation-plan.md 5.3): the checklist
 * as a list of steps beside the one being worked on, with "Finish setup"
 * under the list. Each step's done state comes from
 * `GET /onboarding/checklist`, refetched after every change, so it stays
 * right however the data got there.
 */
export function OnboardingWizard() {
  const t = useTranslations("onboarding")
  const checklist = useQuery(onboardingChecklistQuery())

  if (checklist.isPending) {
    return (
      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8">
        <div className="flex flex-col gap-2 max-lg:hidden">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }
  if (checklist.isError) return <StepLoadFailed retry={checklist.refetch} />

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("title")}
        </h1>
        <p className="max-w-2xl text-muted-foreground">{t("description")}</p>
      </header>
      <Wizard checklist={checklist.data} />
    </div>
  )
}

const STEP_PARAM = "step"

/**
 * `?step=` as the router has it (server render included); outside the
 * Next router (tests), straight from the address.
 */
function stepParam(params: URLSearchParams | null) {
  if (params) return params.get(STEP_PARAM)
  return typeof window === "undefined"
    ? null
    : new URLSearchParams(window.location.search).get(STEP_PARAM)
}

/** A `?step=` value the wizard can show, or null. */
function viewFrom(
  value: string | null,
  steps: OnboardingStep[]
): WizardView | null {
  if (value === "finish") return "finish"
  return steps.find((s) => s.key === value)?.key ?? null
}

/** Below the sticky header: 6rem from the top. */
const STICKY_OFFSET = 96
/** Space kept under the column when it is taller than the window. */
const STICKY_GAP = 24

/**
 * The `top` for a sticky column that may be taller than the window: the
 * header offset while it fits, so it stays in view; otherwise negative, so
 * it scrolls with the page until its bottom is in view and sticks there.
 * Remeasured when the column or the window changes size.
 */
function useStickyTop(ref: React.RefObject<HTMLElement | null>) {
  const [top, setTop] = useState(STICKY_OFFSET)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () =>
      setTop(
        Math.min(
          STICKY_OFFSET,
          window.innerHeight - el.offsetHeight - STICKY_GAP
        )
      )
    measure()
    // Not everywhere (jsdom): then only the window size is followed.
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure)
    observer?.observe(el)
    window.addEventListener("resize", measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [ref])
  return top
}

function Wizard({ checklist }: { checklist: OnboardingChecklist }) {
  const queryClient = useQueryClient()
  const steps = visibleSteps(checklist)
  const searchParams = useSearchParams()
  // The open step lives in the URL (`?step=grading`) too, so a reload
  // (or a link) opens the same step; else the first one to do.
  const [current, setCurrent] = useState<WizardView | null>(
    () => viewFrom(stepParam(searchParams), steps) ?? firstOpenStep(checklist)
  )
  // Focus follows the step only once someone moves, not on arrival.
  const [moved, setMoved] = useState(false)
  const asideRef = useRef<HTMLElement>(null)
  const stickyTop = useStickyTop(asideRef)
  const index = steps.findIndex((s) => s.key === current)
  const step = steps[index]

  function goTo(view: WizardView) {
    setMoved(true)
    setCurrent(view)
    // Replaced, not pushed: the steps aren't pages to go back through.
    const url = new URL(window.location.href)
    url.searchParams.set(STEP_PARAM, view)
    window.history.replaceState(null, "", url)
  }

  /**
   * On from a step, by the checklist as it is now (see `nextOpenStep`):
   * forward to the next step to do, back to a required one still open, or
   * to the last page, where setup is finished.
   */
  function advance(from: OnboardingStepKey) {
    const latest =
      queryClient.getQueryData<OnboardingChecklist>(onboardingKeys.checklist) ??
      checklist
    goTo(nextOpenStep(latest, from) ?? "finish")
  }

  return (
    // One column on phones, held to the screen's width: the step chips
    // scroll sideways within it instead of widening the page.
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:gap-x-8">
      {/* Wide screens: the steps and the progress card stay in view while
          the step scrolls (see `useStickyTop`); the column never scrolls
          on its own. On the finish page the card steps aside: the page is
          that card, expanded. Phones: the aside dissolves into the grid
          (`contents`) so the order is steps, step, card. */}
      <aside
        ref={asideRef}
        style={{ top: stickyTop }}
        className="max-lg:contents lg:sticky lg:col-start-1 lg:row-start-1 lg:flex lg:flex-col lg:gap-6"
      >
        <StepNav
          steps={steps}
          current={current}
          onSelect={goTo}
          className="max-lg:order-1"
        />
        {current !== "finish" && (
          <div className="max-lg:order-3">
            <FinishCard checklist={checklist} current={current} onGoTo={goTo} />
          </div>
        )}
      </aside>
      {current === "finish" && (
        <FinishPanel
          checklist={checklist}
          focusOnMount={moved}
          onBack={() => goTo(steps[steps.length - 1]!.key)}
          onGoTo={goTo}
          className="max-lg:order-2 lg:col-start-2 lg:row-start-1"
        />
      )}
      {step && (
        <StepPanel
          key={step.key}
          step={step}
          number={index + 1}
          total={steps.length}
          focusOnMount={moved}
          onBack={index > 0 ? () => goTo(steps[index - 1]!.key) : null}
          onContinue={() => advance(step.key)}
          onGoTo={goTo}
          className="max-lg:order-2 lg:col-start-2 lg:row-start-1"
        />
      )}
    </div>
  )
}

/**
 * Every step with its state. A row of chips that scrolls sideways on
 * phones, a vertical list from `lg`, the optional steps set apart.
 */
function StepNav({
  steps,
  current,
  onSelect,
  className,
}: {
  steps: OnboardingStep[]
  current: WizardView | null
  onSelect: (view: WizardView) => void
  className?: string
}) {
  const t = useTranslations("onboarding")
  const tf = useTranslations("onboarding.finish")
  const onFinish = current === "finish"
  const f = useSchoolFormat()
  const done = steps.filter((s) => s.done).length
  const firstOptional = steps.find((s) => !s.required)?.key

  return (
    <nav aria-label={t("stepsLabel")} className={cn("min-w-0", className)}>
      <div className="mb-3 flex items-baseline justify-between gap-2 max-lg:hidden">
        <span className="text-sm font-medium">{t("stepsLabel")}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t("stepsDone", {
            done: f.number(done),
            total: f.number(steps.length),
          })}
        </span>
      </div>
      {/* `relative`: the visually hidden status labels position against
          the scrolling row, not the page (which they would widen). */}
      <ol className="relative -mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:p-0">
        {steps.map((step, i) => {
          const active = step.key === current
          return (
            <li key={step.key} className="shrink-0">
              {step.key === firstOptional && i > 0 && (
                <div
                  aria-hidden
                  className="mt-4 mb-1.5 px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase max-lg:hidden"
                >
                  {t("optional")}
                </div>
              )}
              <button
                type="button"
                aria-current={active ? "step" : undefined}
                onClick={() => onSelect(step.key)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-full border bg-card py-1.5 pr-3.5 pl-1.5 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                  "lg:rounded-lg lg:border-transparent lg:bg-transparent lg:px-3 lg:py-1.5",
                  active
                    ? "border-primary/40 bg-primary/5 lg:bg-card lg:shadow-sm lg:ring-1 lg:ring-border"
                    : "hover:bg-muted lg:hover:bg-card/60"
                )}
              >
                <StepMarker
                  number={f.plain(i + 1)}
                  done={step.done}
                  active={active}
                />
                <span className="flex min-w-0 flex-col">
                  <span
                    className={cn(
                      "truncate whitespace-nowrap lg:whitespace-normal",
                      active ? "font-medium" : "text-foreground/85"
                    )}
                  >
                    {t(`steps.${step.key}.title`)}
                  </span>
                  <span
                    className={cn(
                      "sr-only text-xs lg:not-sr-only",
                      step.done ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {step.done
                      ? t("done")
                      : step.required
                        ? t("required")
                        : t("optional")}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
        {/* The last page, where setup is finished. */}
        <li className="shrink-0 lg:mt-3 lg:border-t lg:pt-3">
          <button
            type="button"
            aria-current={onFinish ? "step" : undefined}
            onClick={() => onSelect("finish")}
            className={cn(
              "group flex w-full items-center gap-3 rounded-full border bg-card py-1.5 pr-3.5 pl-1.5 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
              "lg:rounded-lg lg:border-transparent lg:bg-transparent lg:px-3 lg:py-1.5",
              onFinish
                ? "border-primary/40 bg-primary/5 lg:bg-card lg:shadow-sm lg:ring-1 lg:ring-border"
                : "hover:bg-muted lg:hover:bg-card/60"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors",
                onFinish
                  ? "border-primary text-primary ring-3 ring-primary/15"
                  : "bg-background text-muted-foreground"
              )}
            >
              <FlagIcon className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span
                className={cn(
                  "truncate whitespace-nowrap lg:whitespace-normal",
                  onFinish ? "font-medium" : "text-foreground/85"
                )}
              >
                {tf("label")}
              </span>
              <span className="sr-only text-xs text-muted-foreground lg:not-sr-only">
                {tf("lastStep")}
              </span>
            </span>
          </button>
        </li>
      </ol>
    </nav>
  )
}

function StepMarker({
  number,
  done,
  active,
}: {
  number: string
  done: boolean
  active: boolean
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-colors",
        done
          ? "border-transparent bg-primary text-primary-foreground"
          : active
            ? "border-primary text-primary ring-3 ring-primary/15"
            : "bg-background text-muted-foreground"
      )}
    >
      {done ? <CheckIcon className="size-3.5" strokeWidth={3} /> : number}
    </span>
  )
}

/**
 * The step being worked on: what it is, its form or templates, and the
 * way on (back, continue once done, skip an optional one). Moving to
 * another step puts focus on its heading.
 */
function StepPanel({
  step,
  number,
  total,
  focusOnMount,
  onBack,
  onContinue,
  onGoTo,
  className,
}: {
  step: OnboardingStep
  number: number
  total: number
  focusOnMount: boolean
  onBack: (() => void) | null
  onContinue: () => void
  onGoTo: (key: OnboardingStepKey) => void
  className?: string
}) {
  const t = useTranslations("onboarding")
  const f = useSchoolFormat()
  const headingId = useId()
  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const Icon = STEP_ICONS[step.key]

  // The panel remounts per step (keyed), so this runs once per move.
  useEffect(() => {
    const section = sectionRef.current
    if (!focusOnMount || !section) return
    headingRef.current?.focus({ preventScroll: true })
    if (section.getBoundingClientRect().top < 80) {
      section.scrollIntoView?.({ behavior: "smooth", block: "start" })
    }
  }, [focusOnMount])

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
          <Icon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">
            {t("stepOf", { n: f.plain(number), total: f.plain(total) })}
            {" · "}
            <span className={step.done ? "text-primary" : undefined}>
              {step.done
                ? t("done")
                : step.required
                  ? t("required")
                  : t("optional")}
            </span>
          </p>
          <h2
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
            className="text-lg font-semibold tracking-tight outline-none sm:text-xl"
          >
            {t(`steps.${step.key}.title`)}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(`steps.${step.key}.summary`)}
          </p>
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <StepBody step={step} onContinue={onContinue} onGoTo={onGoTo} />
      </div>
      {/* Stays at the bottom of the screen while a long step scrolls;
          left out when it would be empty (the first step, not done yet:
          its own form is the way on). */}
      {(onBack || step.done || !step.required) && (
        <div className="sticky bottom-0 z-10 mt-auto flex items-center justify-between gap-2 rounded-b-xl border-t bg-card/95 px-5 py-3 backdrop-blur supports-backdrop-filter:bg-card/80 sm:px-6">
          {onBack ? (
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeftIcon />
              {t("back")}
            </Button>
          ) : (
            <span />
          )}
          {step.done ? (
            // The profile's own form already saves and continues.
            <Button
              variant={step.key === "profile" ? "outline" : "default"}
              onClick={onContinue}
            >
              {t("continue")}
              <ArrowRightIcon />
            </Button>
          ) : (
            !step.required && (
              <Button variant="outline" onClick={onContinue}>
                {number === total ? t("skipToFinish") : t("skipStep")}
                <ArrowRightIcon />
              </Button>
            )
          )}
        </div>
      )}
    </section>
  )
}

function StepBody({
  step,
  onContinue,
  onGoTo,
}: {
  step: OnboardingStep
  onContinue: () => void
  onGoTo: (key: OnboardingStepKey) => void
}) {
  switch (step.key) {
    case "profile":
      return <ProfileStep onContinue={onContinue} />
    case "session":
      return <SessionStep />
    case "classes":
      return <ClassesStep onGoTo={onGoTo} />
    case "curriculum":
      return <CurriculumStep />
    case "grading":
      return <GradingStep />
    case "fees":
      return <FeesStep />
    case "staff":
      return <StaffStep />
  }
}
