"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { CircleCheckIcon, CircleIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useId, useState } from "react"

import {
  onboardingChecklistQuery,
  onboardingKeys,
  type OnboardingChecklist,
  type OnboardingStep,
  type OnboardingStepKey,
} from "~/api/onboarding"
import { Badge } from "~/components/ui/badge"
import { Skeleton } from "~/components/ui/skeleton"
import { useSchoolFormat } from "~/hooks/use-school-format"
import { cn } from "~/lib/utils"

import { ClassesStep } from "./classes-step"
import { FinishBar } from "./finish-bar"
import { ProfileStep } from "./profile-step"
import { SessionStep } from "./session-step"
import { StepLoadFailed } from "./step-parts"
import { firstOpenStep, nextOpenStep, visibleSteps } from "./steps"
import {
  CurriculumStep,
  FeesStep,
  GradingStep,
  LaterStep,
} from "./template-steps"

/**
 * `/onboarding` (doc/frontend-implementation-plan.md 5.3): the checklist
 * as a list of steps, one open at a time. Each step's done state comes
 * from `GET /onboarding/checklist`, refetched after every change, so it
 * stays right however the data got there.
 */
export function OnboardingWizard() {
  const t = useTranslations("onboarding")
  const checklist = useQuery(onboardingChecklistQuery())

  if (checklist.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    )
  }
  if (checklist.isError) return <StepLoadFailed retry={checklist.refetch} />

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </header>
      <Steps checklist={checklist.data} />
      <FinishBar checklist={checklist.data} />
    </div>
  )
}

function Steps({ checklist }: { checklist: OnboardingChecklist }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState<OnboardingStepKey | null>(() =>
    firstOpenStep(checklist)
  )

  /** To the next step still to do, by the checklist as it is now. */
  function advance(from: OnboardingStepKey) {
    const latest =
      queryClient.getQueryData<OnboardingChecklist>(onboardingKeys.checklist) ??
      checklist
    setOpen(nextOpenStep(latest, from))
  }

  return (
    <ol className="flex flex-col gap-3">
      {visibleSteps(checklist).map((step, index) => (
        <StepItem
          key={step.key}
          step={step}
          number={index + 1}
          open={open === step.key}
          onToggle={() => setOpen(open === step.key ? null : step.key)}
        >
          <StepBody
            step={step}
            onContinue={() => advance(step.key)}
            onGoTo={setOpen}
          />
        </StepItem>
      ))}
    </ol>
  )
}

function StepItem({
  step,
  number,
  open,
  onToggle,
  children,
}: {
  step: OnboardingStep
  number: number
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  const t = useTranslations("onboarding")
  const f = useSchoolFormat()
  const id = useId()
  const panelId = `${id}-panel`

  return (
    <li
      className={cn(
        "rounded-xl border bg-card transition-shadow",
        open && "shadow-sm ring-1 ring-ring/20"
      )}
    >
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center gap-3 rounded-xl p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium",
              step.done
                ? "border-transparent bg-primary text-primary-foreground"
                : "text-muted-foreground"
            )}
          >
            {step.done ? (
              <CircleCheckIcon aria-hidden className="size-4" />
            ) : (
              f.plain(number)
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-medium">{t(`steps.${step.key}.title`)}</span>
            <span className="text-sm text-muted-foreground">
              {t(`steps.${step.key}.summary`)}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
            {step.done ? (
              <Badge variant="secondary">{t("done")}</Badge>
            ) : step.required ? (
              <Badge variant="outline">{t("required")}</Badge>
            ) : (
              <Badge variant="ghost" className="text-muted-foreground">
                <CircleIcon aria-hidden className="size-2" />
                {t("optional")}
              </Badge>
            )}
          </span>
        </button>
      </h2>
      <div
        id={panelId}
        role="region"
        aria-label={t(`steps.${step.key}.title`)}
        hidden={!open}
        className="border-t px-4 pt-4 pb-4"
      >
        {open && children}
      </div>
    </li>
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
  const props = { done: step.done, onContinue, onGoTo }
  switch (step.key) {
    case "profile":
      return <ProfileStep onContinue={onContinue} />
    case "session":
      return <SessionStep onContinue={onContinue} />
    case "classes":
      return <ClassesStep {...props} />
    case "curriculum":
      return <CurriculumStep {...props} />
    case "grading":
      return <GradingStep {...props} />
    case "fees":
      return <FeesStep {...props} />
    case "staff":
    case "students":
      return <LaterStep step={step.key} {...props} />
  }
}
