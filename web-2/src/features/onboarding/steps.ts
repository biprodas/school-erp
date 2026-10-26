import type {
  CurriculumTemplate,
  OnboardingChecklist,
  OnboardingStep,
  OnboardingStepKey,
  SchoolType,
} from "~/features/onboarding/api"

/** Steps the wizard shows: the ones whose feature exists. */
export const visibleSteps = (checklist: OnboardingChecklist) =>
  checklist.steps.filter((step) => step.available)

/**
 * The step to open first: the first required one still to do, then the
 * first optional one, else the first step.
 */
export function firstOpenStep(
  checklist: OnboardingChecklist
): OnboardingStepKey | null {
  const steps = visibleSteps(checklist)
  return (
    steps.find((s) => s.required && !s.done)?.key ??
    steps.find((s) => !s.done)?.key ??
    steps[0]?.key ??
    null
  )
}

/**
 * Where to go from `key`: the next step after it still to do; past the
 * end, back to a required step still open (an optional one skipped
 * earlier stays skipped); else nowhere (on to "Finish setup").
 */
export function nextOpenStep(
  checklist: OnboardingChecklist,
  key: OnboardingStepKey
): OnboardingStepKey | null {
  const steps = visibleSteps(checklist)
  const index = steps.findIndex((s) => s.key === key)
  return (
    steps.slice(index + 1).find((s) => !s.done)?.key ??
    steps.find((s) => s.required && !s.done && s.key !== key)?.key ??
    null
  )
}

/** Required steps that stop "Finish setup". */
export const missingRequired = (checklist: OnboardingChecklist) =>
  visibleSteps(checklist).filter((s) => s.required && !s.done)

export const stepDone = (
  checklist: OnboardingChecklist | undefined,
  key: OnboardingStepKey
) => checklist?.steps.some((s: OnboardingStep) => s.key === key && s.done)

/** Templates meant for this kind of school first, keeping their order. */
export function sortTemplates(
  templates: CurriculumTemplate[],
  type: SchoolType | undefined
): { template: CurriculumTemplate; suggested: boolean }[] {
  const rows = templates.map((template) => ({
    template,
    suggested: type ? template.suggestedFor.includes(type) : false,
  }))
  return [
    ...rows.filter((r) => r.suggested),
    ...rows.filter((r) => !r.suggested),
  ]
}

/**
 * The next section name after the ones a class has: "A" for none, then
 * the letter after the highest single letter ("A", "B" → "C").
 */
export function nextSectionName(existing: string[]): string {
  const letters = existing
    .map((name) => name.trim().toUpperCase())
    .filter((name) => /^[A-Y]$/.test(name))
    .map((name) => name.charCodeAt(0))
  if (!letters.length) return existing.length ? "" : "A"
  return String.fromCharCode(Math.max(...letters) + 1)
}

export interface SessionDates {
  name: string
  /** `YYYY-MM-DD`. */
  startDate: string
  endDate: string
}

/** A session spanning this calendar year, the usual case in Bangladesh. */
export function defaultSession(today: string): SessionDates {
  const year = today.slice(0, 4)
  return {
    name: year,
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  }
}

export type SessionPreset = "calendar" | "july"

/**
 * The usual school years around today: January to December (most schools
 * in Bangladesh) and the July to June year that today falls in.
 */
export function sessionPresets(
  today: string
): { key: SessionPreset; dates: SessionDates }[] {
  const year = Number(today.slice(0, 4))
  const july = Number(today.slice(5, 7)) >= 7 ? year : year - 1
  return [
    { key: "calendar", dates: defaultSession(today) },
    {
      key: "july",
      dates: {
        name: `${july}–${july + 1}`,
        startDate: `${july}-07-01`,
        endDate: `${july + 1}-06-30`,
      },
    },
  ]
}

/** Whole months from `start` to `end` (inclusive days): 1 Jan–31 Dec is 12. */
export function sessionMonths(start: string, end: string): number {
  const days =
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
      86_400_000 +
    1
  return Math.max(1, Math.round(days / (365.25 / 12)))
}

/**
 * The months of a school year from its first month (1–12), as calendar
 * month numbers: a July session runs 7, 8, …, 12, 1, …, 6.
 */
export function sessionMonthOrder(firstMonth: number): number[] {
  return Array.from({ length: 12 }, (_, i) => ((firstMonth - 1 + i) % 12) + 1)
}

/**
 * Where in the school year (0–11, from its first month) a fee head is
 * billed: every month, every third month, or the first month. A one-time
 * fee has no month: it is charged once per student, when it applies.
 */
export function billingMonths(
  frequency: "monthly" | "quarterly" | "yearly" | "one_time"
): number[] {
  switch (frequency) {
    case "monthly":
      return Array.from({ length: 12 }, (_, i) => i)
    case "quarterly":
      return [0, 3, 6, 9]
    case "yearly":
      return [0]
    case "one_time":
      return []
  }
}

/** The calendar years a session touches (holidays are added per year). */
export function sessionYears(start: string, end: string): number[] {
  const years: number[] = []
  for (let y = Number(start.slice(0, 4)); y <= Number(end.slice(0, 4)); y++) {
    years.push(y)
  }
  return years
}
