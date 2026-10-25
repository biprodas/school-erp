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

/** The step after `key` that is still to do (wrapping to the first one). */
export function nextOpenStep(
  checklist: OnboardingChecklist,
  key: OnboardingStepKey
): OnboardingStepKey | null {
  const steps = visibleSteps(checklist)
  const index = steps.findIndex((s) => s.key === key)
  const after = [...steps.slice(index + 1), ...steps.slice(0, index)]
  return after.find((s) => !s.done)?.key ?? null
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

/** A session spanning this calendar year, the usual case in Bangladesh. */
export function defaultSession(today: string) {
  const year = today.slice(0, 4)
  return {
    name: year,
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  }
}
