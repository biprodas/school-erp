"use client"

import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"

import { academicKeys, currentSessionQuery } from "~/features/academics/api"
import {
  applyCurriculumTemplate,
  applyFeeHeadsTemplate,
  applyGradingTemplate,
  onboardingTemplatesQuery,
  type OnboardingTemplates,
} from "~/features/onboarding/api"
import { schoolSettingsQuery } from "~/features/settings/api"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Skeleton } from "~/components/ui/skeleton"
import { Spinner } from "~/components/ui/spinner"
import { useSchoolFormat } from "~/features/settings/use-school-format"

import type { StepProps } from "./classes-step"
import { sortTemplates } from "../steps"
import { ContinueButton, StepLoadFailed, StepNote } from "./step-parts"
import { useSetupAction } from "../use-setup-action"

type TemplateStepProps = StepProps & { done: boolean }

/** The templates, or a skeleton / retry while they load. */
function WithTemplates({
  children,
}: {
  children: (templates: OnboardingTemplates) => React.ReactNode
}) {
  const templates = useQuery(onboardingTemplatesQuery())
  if (templates.isPending) return <Skeleton className="h-48 rounded-lg" />
  if (templates.isError) return <StepLoadFailed retry={templates.refetch} />
  return children(templates.data)
}

/** One template to apply: name, what it adds, and its button. */
function TemplateCard({
  name,
  description,
  badge,
  details,
  action,
  pending,
  onApply,
}: {
  name: string
  description: string
  badge?: string
  details?: React.ReactNode
  action: string
  pending: boolean
  onApply: () => void
}) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2 font-medium">
          {name}
          {badge && <Badge>{badge}</Badge>}
        </span>
        <span className="text-sm text-muted-foreground">{description}</span>
        {details}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 self-start"
        disabled={pending}
        aria-label={`${action}: ${name}`}
        onClick={onApply}
      >
        {pending && <Spinner />}
        {action}
      </Button>
    </li>
  )
}

/**
 * Step 4: subjects for each class, from a curriculum template. Applying
 * also adds the template's classes; class subjects go into the current
 * session, so without one only subjects and classes are added.
 */
export function CurriculumStep({ done, onContinue }: TemplateStepProps) {
  const t = useTranslations("onboarding.curriculum")
  const f = useSchoolFormat()
  const settings = useQuery(schoolSettingsQuery())
  const session = useQuery(currentSessionQuery())
  const apply = useSetupAction({
    action: applyCurriculumTemplate,
    invalidate: [academicKeys.classes],
    success: ({ created }) =>
      created.classes + created.subjects + created.classSubjects === 0
        ? t("alreadyApplied")
        : t("applied", {
            classes: f.number(created.classes),
            subjects: f.number(created.classSubjects),
          }),
  })

  return (
    <div className="flex flex-col gap-4">
      {done && <StepNote>{t("done")}</StepNote>}
      {session.isSuccess && !session.data && (
        <StepNote tone="info">{t("needSession")}</StepNote>
      )}
      <WithTemplates>
        {(templates) => (
          <ul className="flex flex-col gap-2" aria-label={t("listLabel")}>
            {sortTemplates(
              templates.curriculum,
              settings.data?.organization.type
            ).map(({ template, suggested }) => (
              <TemplateCard
                key={template.code}
                name={template.name}
                description={template.description}
                badge={suggested ? t("suggested") : undefined}
                details={
                  <span className="text-xs text-muted-foreground">
                    {t("contents", {
                      classes: f.number(template.classes.length),
                      subjects: f.number(template.subjects),
                    })}
                  </span>
                }
                action={t("apply")}
                pending={apply.isPending && apply.variables === template.code}
                onApply={() => apply.mutate(template.code)}
              />
            ))}
          </ul>
        )}
      </WithTemplates>
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      {done && <ContinueButton onContinue={onContinue} />}
    </div>
  )
}

/** Step 5 (optional): a grading system; the first one becomes the default. */
export function GradingStep({ done, onContinue }: TemplateStepProps) {
  const t = useTranslations("onboarding.grading")
  const apply = useSetupAction({
    action: applyGradingTemplate,
    success: ({ created }) => (created ? t("applied") : t("alreadyApplied")),
  })

  return (
    <div className="flex flex-col gap-4">
      {done && <StepNote>{t("done")}</StepNote>}
      <WithTemplates>
        {(templates) => (
          <ul className="flex flex-col gap-2" aria-label={t("listLabel")}>
            {templates.grading.map((template, index) => (
              <TemplateCard
                key={template.code}
                name={template.name}
                description={template.description}
                badge={index === 0 ? t("recommended") : undefined}
                action={t("apply")}
                pending={apply.isPending && apply.variables === template.code}
                onApply={() => apply.mutate(template.code)}
              />
            ))}
          </ul>
        )}
      </WithTemplates>
      <ContinueButton onContinue={onContinue} />
    </div>
  )
}

/** Step 6 (optional): the usual fee heads. */
export function FeesStep({ done, onContinue }: TemplateStepProps) {
  const t = useTranslations("onboarding.fees")
  const apply = useSetupAction({
    action: applyFeeHeadsTemplate,
    success: () => t("applied"),
  })

  return (
    <div className="flex flex-col gap-4">
      {done && <StepNote>{t("done")}</StepNote>}
      <WithTemplates>
        {(templates) => (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{t("body")}</p>
            <ul className="flex flex-wrap gap-1.5" aria-label={t("listLabel")}>
              {templates.feeHeads.items.map((head) => (
                <li key={head.name}>
                  <Badge variant="secondary">
                    {head.name} · {t(`frequency.${head.frequency}`)}
                  </Badge>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              className="self-start"
              disabled={apply.isPending}
              onClick={() => apply.mutate(undefined)}
            >
              {apply.isPending && <Spinner />}
              {t("apply")}
            </Button>
          </div>
        )}
      </WithTemplates>
      <ContinueButton onContinue={onContinue} />
    </div>
  )
}

/**
 * Steps 7 and 8 (optional): staff and students have their own screens in
 * the staff app, opened once setup is finished or skipped.
 */
export function LaterStep({
  step,
  done,
  onContinue,
}: TemplateStepProps & { step: "staff" | "students" }) {
  const t = useTranslations(`onboarding.${step}`)
  return (
    <div className="flex flex-col gap-4">
      <StepNote tone={done ? "done" : "info"}>
        {done ? t("done") : t("later")}
      </StepNote>
      <ContinueButton onContinue={onContinue} />
    </div>
  )
}
