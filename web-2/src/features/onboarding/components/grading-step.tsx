"use client"

import { useQuery } from "@tanstack/react-query"
import { CheckIcon, ChevronDownIcon, StarIcon, Trash2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useId, useState } from "react"

import {
  applyGradingTemplate,
  deleteGradingSystem,
  gradingSystemsQuery,
  makeDefaultGradingSystem,
  onboardingKeys,
  type GradeBand,
  type GradingKind,
  type GradingSystem,
  type GradingTemplate,
} from "~/features/onboarding/api"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Skeleton } from "~/components/ui/skeleton"
import { Spinner } from "~/components/ui/spinner"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { cn } from "~/lib/utils"

import { StepLoadFailed, StepNote } from "./step-parts"
import { WithTemplates } from "./template-steps"
import { useSetupAction } from "../use-setup-action"

const systemsKey = onboardingKeys.gradingSystems

/**
 * Step 5 (optional): the school's grading systems with their grade scales
 * (which one is the default, and what each grade means), and the
 * templates to add one from. The first one added becomes the default.
 */
export function GradingStep() {
  const t = useTranslations("onboarding.grading")
  const systems = useQuery(gradingSystemsQuery())

  if (systems.isPending) return <Skeleton className="h-48 rounded-lg" />
  if (systems.isError) return <StepLoadFailed retry={systems.refetch} />

  const applied = new Set(systems.data.map((s) => s.templateCode))

  return (
    <div className="flex flex-col gap-6">
      {systems.data.length === 0 ? (
        <StepNote tone="info">{t("empty")}</StepNote>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-semibold">
              {t("yours", { count: systems.data.length })}
            </h3>
            <p className="text-sm text-muted-foreground">{t("defaultHint")}</p>
          </div>
          <ul className="flex flex-col gap-3">
            {systems.data.map((system) => (
              <SystemCard key={system.id} system={system} />
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">
          {systems.data.length ? t("addAnother") : t("choose")}
        </h3>
        <WithTemplates>
          {(templates) => (
            <ul className="flex flex-col gap-2" aria-label={t("listLabel")}>
              {templates.grading.map((template, index) => (
                <TemplateOption
                  key={template.code}
                  template={template}
                  recommended={index === 0}
                  applied={applied.has(template.code)}
                />
              ))}
            </ul>
          )}
        </WithTemplates>
      </section>
    </div>
  )
}

/** One of the school's systems: name, default or not, and its scale. */
function SystemCard({ system }: { system: GradingSystem }) {
  const t = useTranslations("onboarding.grading")
  const makeDefault = useSetupAction({
    action: () => makeDefaultGradingSystem(system.id),
    invalidate: [systemsKey],
    success: () => t("madeDefault", { name: system.name }),
  })
  const remove = useSetupAction({
    action: () => deleteGradingSystem(system.id),
    invalidate: [systemsKey],
    success: () => t("removed", { name: system.name }),
  })
  const bands = [...system.items].sort((a, b) => a.sortOrder - b.sortOrder)
  const busy = makeDefault.isPending || remove.isPending

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-3 sm:p-4",
        system.isDefault && "border-primary/40 bg-primary/5"
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2 font-medium">
            {system.name}
            {system.isDefault && (
              <Badge>
                <StarIcon aria-hidden />
                {t("default")}
              </Badge>
            )}
          </span>
          <KindLabel kind={system.kind} bands={bands} />
        </div>
        {!system.isDefault && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => makeDefault.mutate(undefined)}
            >
              {makeDefault.isPending ? <Spinner /> : <StarIcon aria-hidden />}
              {t("makeDefault")}
            </Button>
            {/* The default stays: classes without their own need one. */}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("remove", { name: system.name })}
              title={t("remove", { name: system.name })}
              disabled={busy}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => remove.mutate(undefined)}
            >
              {remove.isPending ? <Spinner /> : <Trash2Icon aria-hidden />}
            </Button>
          </div>
        )}
      </div>
      <GradeScale name={system.name} kind={system.kind} bands={bands} />
    </li>
  )
}

/** A template: what it is, its grades on demand, and "Use this". */
function TemplateOption({
  template,
  recommended,
  applied,
}: {
  template: GradingTemplate
  recommended: boolean
  applied: boolean
}) {
  const t = useTranslations("onboarding.grading")
  const [showScale, setShowScale] = useState(false)
  const scaleId = useId()
  const apply = useSetupAction({
    action: applyGradingTemplate,
    invalidate: [systemsKey],
    success: ({ created, gradingSystem }) =>
      !created
        ? t("alreadyApplied")
        : gradingSystem.isDefault
          ? t("appliedDefault", { name: gradingSystem.name })
          : t("applied", { name: gradingSystem.name }),
  })

  return (
    <li className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2 font-medium">
            {template.name}
            {recommended && (
              <Badge variant="secondary">{t("recommended")}</Badge>
            )}
          </span>
          <span className="text-sm text-muted-foreground">
            {template.description}
          </span>
          <button
            type="button"
            aria-expanded={showScale}
            aria-controls={scaleId}
            onClick={() => setShowScale(!showScale)}
            className="flex items-center gap-1 self-start rounded-sm text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {showScale ? t("hideScale") : t("showScale")}
            <ChevronDownIcon
              aria-hidden
              className={cn(
                "size-4 transition-transform",
                showScale && "rotate-180"
              )}
            />
          </button>
        </div>
        {applied ? (
          <Badge variant="secondary" className="h-8 shrink-0 self-start px-3">
            <CheckIcon aria-hidden />
            {t("added")}
          </Badge>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 self-start"
            disabled={apply.isPending}
            aria-label={`${t("apply")}: ${template.name}`}
            onClick={() => apply.mutate(template.code)}
          >
            {apply.isPending && <Spinner />}
            {t("apply")}
          </Button>
        )}
      </div>
      <div id={scaleId} hidden={!showScale}>
        {showScale && (
          <GradeScale
            name={template.name}
            kind={template.kind}
            bands={template.bands}
          />
        )}
      </div>
    </li>
  )
}

/** "GPA out of 5" or the kind of scale. */
function KindLabel({ kind, bands }: { kind: GradingKind; bands: GradeBand[] }) {
  const t = useTranslations("onboarding.grading")
  const f = useSchoolFormat()
  const top = Math.max(0, ...bands.map((b) => b.point))
  return (
    <span className="text-sm text-muted-foreground">
      {kind === "gpa"
        ? t("kinds.gpa", { scale: f.number(top) })
        : t(`kinds.${kind}`)}
    </span>
  )
}

/** Each grade with its marks range (and point), failing grades in red. */
function GradeScale({
  name,
  kind,
  bands,
}: {
  name: string
  kind: GradingKind
  bands: GradeBand[]
}) {
  const t = useTranslations("onboarding.grading")
  const f = useSchoolFormat()
  const showPoints = kind !== "percentage"

  return (
    <ul
      aria-label={t("scaleLabel", { name })}
      className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1.5"
    >
      {bands.map((band) => (
        <li
          key={band.letter}
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-md border bg-background px-2 py-1.5 text-center",
            band.isFail && "border-destructive/30 bg-destructive/5"
          )}
        >
          <span
            className={cn(
              "text-sm font-semibold",
              band.isFail && "text-destructive"
            )}
          >
            {band.letter}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("range", {
              min: f.number(band.minPercent),
              max: f.number(band.maxPercent),
            })}
          </span>
          {showPoints && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("point", { point: f.number(band.point) })}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
