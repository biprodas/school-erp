"use client"

import { useQuery } from "@tanstack/react-query"
import { CheckIcon, StarIcon, Trash2Icon } from "lucide-react"
import { useTranslations } from "next-intl"

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

import { StepLoadFailed } from "./step-parts"
import { WithTemplates } from "./template-steps"
import { useSetupAction } from "../use-setup-action"

const systemsKey = onboardingKeys.gradingSystems

/**
 * Step 5 (optional): the school's grading systems, the default one drawn
 * as a marks ruler (which marks earn which grade, where the pass mark
 * is), and the templates to add one from, each with its ruler in small.
 * The first one added becomes the default.
 */
export function GradingStep() {
  const t = useTranslations("onboarding.grading")
  const systems = useQuery(gradingSystemsQuery())

  if (systems.isPending) return <Skeleton className="h-48 rounded-lg" />
  if (systems.isError) return <StepLoadFailed retry={systems.refetch} />

  const applied = new Set(systems.data.map((s) => s.templateCode))
  const [main, ...others] = systems.data

  return (
    <div className="flex flex-col gap-6">
      {main && (
        <Section
          title={t("yours", { count: systems.data.length })}
          hint={t("defaultHint")}
        >
          <div className="flex flex-col gap-4">
            <DefaultSystem system={main} />
            {others.length > 0 && (
              <ul className="flex flex-col divide-y rounded-lg border">
                {others.map((system) => (
                  <OtherSystem key={system.id} system={system} />
                ))}
              </ul>
            )}
          </div>
        </Section>
      )}

      <Section
        title={main ? t("addAnother") : t("choose")}
        hint={main ? t("templatesHint") : t("empty")}
      >
        <WithTemplates>
          {(templates) => (
            <ul
              className="flex flex-col divide-y rounded-lg border"
              aria-label={t("listLabel")}
            >
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
      </Section>
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

const byMarks = (bands: GradeBand[]) =>
  [...bands].sort((a, b) => b.minPercent - a.minPercent)

/** The default system: its name, what it is, and its full ruler. */
function DefaultSystem({ system }: { system: GradingSystem }) {
  const t = useTranslations("onboarding.grading")
  const bands = byMarks(system.items)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
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
      <GradeScale
        label={t("scaleLabel", { name: system.name })}
        kind={system.kind}
        bands={bands}
      />
    </div>
  )
}

/** Another of the school's systems: its small ruler, make default, remove. */
function OtherSystem({ system }: { system: GradingSystem }) {
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
  const bands = byMarks(system.items)
  const busy = makeDefault.isPending || remove.isPending

  return (
    <li className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex flex-col">
          <span className="text-sm font-medium">{system.name}</span>
          <KindLabel kind={system.kind} bands={bands} />
        </span>
        <GradeScale
          label={t("scaleLabel", { name: system.name })}
          kind={system.kind}
          bands={bands}
          compact
        />
      </div>
      {/* The default stays: classes without their own need one. */}
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
    </li>
  )
}

/** A template: what it is, its small ruler, and "Use this". */
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
    <li className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {template.name}
            {recommended && (
              <Badge variant="secondary">{t("recommended")}</Badge>
            )}
          </span>
          <span className="text-sm text-muted-foreground">
            {template.description}
          </span>
        </span>
        <GradeScale
          label={t("templateScaleLabel", { name: template.name })}
          kind={template.kind}
          bands={byMarks(template.bands)}
          compact
        />
      </div>
      {/* A fixed column, so the rulers of the list line up. */}
      <div className="flex shrink-0 sm:w-28 sm:justify-end">
        {applied ? (
          <Badge variant="secondary" className="h-8 px-3">
            <CheckIcon aria-hidden />
            {t("added")}
          </Badge>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={apply.isPending}
            aria-label={`${t("apply")}: ${template.name}`}
            onClick={() => apply.mutate(template.code)}
          >
            {apply.isPending && <Spinner />}
            {t("apply")}
          </Button>
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

/** A band's share of the 0–100 line (its marks, inclusive). */
const share = (band: GradeBand) =>
  Math.max(1, band.maxPercent - band.minPercent + 1)

/**
 * The grades' own blue (Tailwind's sky-700), apart from the green of the
 * buttons and steps around the ruler. The same in both themes.
 */
const GRADE_BLUE = "oklch(0.5 0.134 242.75)"

/**
 * A grade's shade: the passing grades from pale to deep blue as they
 * rise, the failing ones in red; white text on the deep shades.
 */
function shade(band: GradeBand, passing: GradeBand[]) {
  if (band.isFail) {
    return { style: undefined, className: "bg-destructive/12 text-destructive" }
  }
  // `passing` runs from the top grade down.
  const rank = passing.length - 1 - passing.indexOf(band)
  const strength =
    passing.length > 1 ? 0.22 + (0.78 * rank) / (passing.length - 1) : 1
  return {
    style: {
      backgroundColor: `color-mix(in oklab, ${GRADE_BLUE} ${Math.round(strength * 100)}%, transparent)`,
    },
    className: strength >= 0.55 ? "text-white" : "text-foreground",
  }
}

/**
 * The grade scale as a marks ruler: bands sized by their marks, from 0 on
 * the left to 100 on the right, the boundaries numbered underneath and the
 * pass mark picked out. Phones get tiles (top grade first) instead, as the
 * bands would be too narrow to label. `compact` is the small ruler: grade
 * letters only, the marks for screen readers.
 */
function GradeScale({
  label,
  kind,
  bands,
  compact = false,
}: {
  /** The list's accessible name. */
  label: string
  kind: GradingKind
  /** Top grade first. */
  bands: GradeBand[]
  compact?: boolean
}) {
  const t = useTranslations("onboarding.grading")
  const f = useSchoolFormat()
  const showPoints = kind !== "percentage"
  const passing = bands.filter((b) => !b.isFail)
  const total = bands.reduce((sum, b) => sum + share(b), 0)

  // Boundaries left to right, at each band's lowest mark, then 100.
  const ascending = [...bands].reverse()
  const ticks = ascending.map((band, i) => ({
    value: band.minPercent,
    left:
      (ascending.slice(0, i).reduce((sum, b) => sum + share(b), 0) / total) *
      100,
  }))
  const top = Math.max(...bands.map((b) => b.maxPercent))
  const passMark = passing.length
    ? Math.min(...passing.map((b) => b.minPercent))
    : null

  return (
    <div className="flex flex-col gap-1.5">
      <ul
        aria-label={label}
        className={cn(
          compact
            ? "flex h-6 flex-row-reverse overflow-hidden rounded"
            : "grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1.5 sm:flex sm:h-14 sm:flex-row-reverse sm:gap-0 sm:overflow-hidden sm:rounded-md"
        )}
      >
        {bands.map((band) => {
          const look = shade(band, passing)
          const range = t("range", {
            min: f.number(band.minPercent),
            max: f.number(band.maxPercent),
          })
          return (
            <li
              key={band.letter}
              // Exactly its share of the line, so the boundaries meet the
              // numbers under the ruler: no grow, no shrink, and separators
              // drawn as an inset shadow (a border would take up width).
              // The grid of tiles on phones ignores the flex basis.
              style={{
                ...look.style,
                flex: `0 0 ${(share(band) / total) * 100}%`,
              }}
              title={`${band.letter}: ${range}`}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center text-center",
                look.className,
                compact
                  ? "text-[11px] font-semibold shadow-[inset_-1px_0_0_var(--card)] first:shadow-none"
                  : "gap-0.5 rounded-md px-2 py-1.5 sm:rounded-none sm:px-0.5 sm:py-0 sm:shadow-[inset_-1px_0_0_var(--card)] sm:first:shadow-none"
              )}
            >
              <span
                className={cn(
                  "truncate",
                  !compact && "text-sm font-semibold",
                  // Too thin to read on a phone: the title and the list
                  // still name it.
                  compact && share(band) / total < 0.07 && "max-sm:sr-only"
                )}
              >
                {band.letter}
              </span>
              <span
                className={cn(
                  "text-xs tabular-nums opacity-80",
                  compact ? "sr-only" : "sm:sr-only"
                )}
              >
                {range}
              </span>
              {showPoints && (
                <span
                  className={cn(
                    "text-xs tabular-nums opacity-80",
                    compact && "sr-only",
                    !compact && "sm:text-[10px]"
                  )}
                >
                  {t("point", { point: f.number(band.point) })}
                </span>
              )}
            </li>
          )
        })}
      </ul>

      {!compact && (
        <div aria-hidden className="relative h-9 max-sm:hidden">
          {[...ticks, { value: top, left: 100 }].map(
            ({ value, left }, i, all) => {
              const isPass = value === passMark
              return (
                <span
                  key={`${value}-${i}`}
                  style={{ left: `${left}%` }}
                  className={cn(
                    "absolute top-0 flex flex-col text-[11px] tabular-nums",
                    i === 0
                      ? "items-start"
                      : i === all.length - 1
                        ? "-translate-x-full items-end"
                        : "-translate-x-1/2 items-center",
                    isPass
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-px",
                      isPass ? "h-2.5 bg-foreground" : "bg-border"
                    )}
                  />
                  {f.number(value)}
                  {isPass && (
                    <span className="font-normal whitespace-nowrap text-muted-foreground">
                      {t("passMark")}
                    </span>
                  )}
                </span>
              )
            }
          )}
        </div>
      )}
    </div>
  )
}
