import { queryOptions } from "@tanstack/react-query"

import { apiFetch } from "~/lib/api/client"

// `OnboardingController` (backend/src/modules/onboarding/): the setup
// checklist, the code-defined templates and applying them. Completing and
// skipping are server actions (`features/onboarding/actions.ts`), because
// they also update the session cookie.

export type OnboardingStepKey =
  | "profile"
  | "session"
  | "classes"
  | "curriculum"
  | "grading"
  | "fees"
  | "staff"
  | "students"

export interface OnboardingStep {
  key: OnboardingStepKey
  /** English title; the UI shows its own translation by `key`. */
  title: string
  link: string
  /** Needed before `POST /onboarding/complete`. */
  required: boolean
  /** False until the feature behind the step exists. */
  available: boolean
  done: boolean
}

/** `GET /onboarding/checklist`, computed from the school's real data. */
export interface OnboardingChecklist {
  steps: OnboardingStep[]
  /** Done steps out of the available ones, 0–100. */
  percentage: number
  /** Every required step is done. */
  canComplete: boolean
  completedAt: string | null
}

/** `OrganizationType` in the backend; chosen in the profile step. */
export const SCHOOL_TYPES = [
  "school",
  "college",
  "madrasa",
  "coaching",
  "english_medium",
] as const
export type SchoolType = (typeof SCHOOL_TYPES)[number]

export interface CurriculumTemplate {
  code: string
  name: string
  description: string
  suggestedFor: SchoolType[]
  /** Class names it adds. */
  classes: string[]
  /** How many subjects it adds. */
  subjects: number
  groups: string[]
}

export interface GradingTemplate {
  code: string
  name: string
  description: string
  kind: "gpa" | "letter" | "percentage"
  scale: number
}

export type HolidayTemplateType = "public" | "school" | "religious"

/** `GET /onboarding/templates`. */
export interface OnboardingTemplates {
  curriculum: CurriculumTemplate[]
  grading: GradingTemplate[]
  feeHeads: {
    items: {
      name: string
      frequency: "once" | "monthly" | "yearly" | "per_exam"
    }[]
  }
  holidays: {
    code: string
    fixed: {
      name: string
      nameBn: string
      type: HolidayTemplateType
      month: number
      day: number
    }[]
    movable: { name: string; nameBn: string; type: HolidayTemplateType }[]
  }
}

export interface CurriculumApplyResult {
  template: string
  academicYearId: string | null
  created: {
    subjects: number
    classes: number
    subjectGroups: number
    groupSubjects: number
    classSubjects: number
    components: number
    classSubjectGroups: number
  }
}

export interface HolidayApplyResult {
  year: number
  created: number
  skipped: number
  toConfirm: { name: string; nameBn: string; type: HolidayTemplateType }[]
}

export const onboardingKeys = {
  checklist: ["onboarding", "checklist"] as const,
  templates: ["onboarding", "templates"] as const,
}

export const onboardingChecklistQuery = () =>
  queryOptions({
    queryKey: onboardingKeys.checklist,
    queryFn: ({ signal }) =>
      apiFetch<OnboardingChecklist>("/onboarding/checklist", { signal }),
    staleTime: 60_000,
  })

/** Code-defined on the backend: they change only with a release. */
export const onboardingTemplatesQuery = () =>
  queryOptions({
    queryKey: onboardingKeys.templates,
    queryFn: ({ signal }) =>
      apiFetch<OnboardingTemplates>("/onboarding/templates", { signal }),
    staleTime: Infinity,
  })

/** Adds the template's subjects, classes and groups (idempotent). */
export const applyCurriculumTemplate = (code: string) =>
  apiFetch<CurriculumApplyResult>(
    `/onboarding/templates/curriculum/${encodeURIComponent(code)}/apply`,
    { method: "POST", body: {} }
  )

/** Creates the grading system once; the first becomes the default. */
export const applyGradingTemplate = (code: string) =>
  apiFetch<{ created: boolean }>(
    `/onboarding/templates/grading/${encodeURIComponent(code)}/apply`,
    { method: "POST", body: {} }
  )

/** Adds the default fee heads the school doesn't have yet. */
export const applyFeeHeadsTemplate = () =>
  apiFetch<unknown>("/onboarding/templates/fee-heads/apply", {
    method: "POST",
    body: {},
  })

/** Bangladesh's fixed-date holidays for `year` (default: this year). */
export const applyBdHolidays = (year?: number) =>
  apiFetch<HolidayApplyResult>("/onboarding/templates/holidays/bd/apply", {
    method: "POST",
    body: year ? { year } : {},
  })
