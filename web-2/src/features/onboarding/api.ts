import { queryOptions } from "@tanstack/react-query"

import { apiFetch, apiFetchPage } from "~/lib/api/client"

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

/** One band of a grade scale, by percentage of full marks. */
export interface GradeBand {
  letter: string
  minPercent: number
  maxPercent: number
  point: number
  isFail: boolean
}

export type GradingKind = "gpa" | "letter" | "percentage"

export interface GradingTemplate {
  code: string
  name: string
  description: string
  kind: GradingKind
  scale: number
  bands: GradeBand[]
}

/** `GET /grading-systems`: one of the school's systems, with its scale. */
export interface GradingSystem {
  id: string
  name: string
  kind: GradingKind
  templateCode: string | null
  /** Used by classes without their own system. */
  isDefault: boolean
  items: (GradeBand & { id: string; sortOrder: number })[]
}

export type HolidayTemplateType = "public" | "school" | "religious"

/** `GET /onboarding/templates`. */
export interface OnboardingTemplates {
  /** The curriculum template the school uses; only one can be applied. */
  curriculumInUse: string | null
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
  gradingSystems: ["grading", "systems"] as const,
  feeHeads: ["fees", "heads"] as const,
  staff: ["employees", "list"] as const,
  roles: ["rbac", "roles"] as const,
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

/**
 * Replaces the curriculum template in use with this one: what the old one
 * added is removed, then this one is added. Refused once there are students.
 */
export const switchCurriculumTemplate = (code: string) =>
  apiFetch<
    CurriculumApplyResult & {
      previous: string | null
      removed: {
        classes: number
        subjects: number
        subjectGroups: number
        classSubjects: number
      }
    }
  >(`/onboarding/templates/curriculum/${encodeURIComponent(code)}/switch`, {
    method: "POST",
    body: {},
  })

/** Creates the grading system once; the first becomes the default. */
export const applyGradingTemplate = (code: string) =>
  apiFetch<{ gradingSystem: GradingSystem; created: boolean }>(
    `/onboarding/templates/grading/${encodeURIComponent(code)}/apply`,
    { method: "POST", body: {} }
  )

/** Adds the default fee heads the school doesn't have yet. */
export const applyFeeHeadsTemplate = () =>
  apiFetch<{ created: number; skipped: number }>(
    "/onboarding/templates/fee-heads/apply",
    {
      method: "POST",
      body: {},
    }
  )

/** Bangladesh's fixed-date holidays for `year` (default: this year). */
export const applyBdHolidays = (year?: number) =>
  apiFetch<HolidayApplyResult>("/onboarding/templates/holidays/bd/apply", {
    method: "POST",
    body: year ? { year } : {},
  })

/** `FeeFrequency` in the backend: how often a fee head is billed. */
export const FEE_FREQUENCIES = [
  "monthly",
  "quarterly",
  "yearly",
  "one_time",
] as const
export type FeeFrequency = (typeof FEE_FREQUENCIES)[number]

/** `GET /fee-heads`: a kind of fee; amounts per class come later. */
export interface FeeHead {
  id: string
  name: string
  nameBn: string | null
  frequency: FeeFrequency
  isActive: boolean
  sortOrder: number
}

export const feeHeadsQuery = () =>
  queryOptions({
    queryKey: onboardingKeys.feeHeads,
    queryFn: ({ signal }) => apiFetch<FeeHead[]>("/fee-heads", { signal }),
  })

export const createFeeHead = (body: {
  name: string
  frequency: FeeFrequency
}) => apiFetch<FeeHead>("/fee-heads", { method: "POST", body })

/** Refused (409) once invoices use it. */
/** How often it is billed. */
export const updateFeeHead = (id: string, body: { frequency: FeeFrequency }) =>
  apiFetch<FeeHead>(`/fee-heads/${id}`, { method: "PATCH", body })

export const deleteFeeHead = (id: string) =>
  apiFetch<void>(`/fee-heads/${id}`, { method: "DELETE" })

/** The school's grading systems, default first. */
export const gradingSystemsQuery = () =>
  queryOptions({
    queryKey: onboardingKeys.gradingSystems,
    queryFn: async ({ signal }) =>
      (await apiFetch<GradingSystem[]>("/grading-systems", { signal })).sort(
        (a, b) => Number(b.isDefault) - Number(a.isDefault)
      ),
  })

export const makeDefaultGradingSystem = (id: string) =>
  apiFetch<GradingSystem>(`/grading-systems/${id}`, {
    method: "PATCH",
    body: { isDefault: true },
  })

/** Refused (409) while a class uses it. */
export const deleteGradingSystem = (id: string) =>
  apiFetch<void>(`/grading-systems/${id}`, { method: "DELETE" })

/** A staff record (`GET /employees`); `userId` once they have a login. */
export interface StaffMember {
  id: string
  employeeNumber: string | null
  firstName: string
  lastName: string
  fullName: string
  email: string | null
  phone: string | null
  userId: string | null
}

/** The school's staff (setup lists stay well under a page). */
export const staffQuery = () =>
  queryOptions({
    queryKey: onboardingKeys.staff,
    queryFn: async ({ signal }) =>
      (
        await apiFetchPage<StaffMember>("/employees", {
          signal,
          query: { page: 1, limit: 100 },
        })
      ).items,
  })

export const createStaffMember = (body: {
  firstName: string
  lastName: string
  phone?: string
  email?: string
}) => apiFetch<StaffMember>("/employees", { method: "POST", body })

/** Soft-deleted; their history stays. */
export const deleteStaffMember = (id: string) =>
  apiFetch<void>(`/employees/${id}`, { method: "DELETE" })

/**
 * `POST /employees/:id/invite`: an activation link by email, or for
 * phone-only staff a one-time password to hand over (shown only now).
 */
export type StaffInviteResult =
  | { userId: string; delivery: "email" }
  | { userId: string; delivery: "slip"; temporaryPassword: string }
  | { userId: string; delivery: "existing_account" }

export const inviteStaffMember = (id: string, roleId: string) =>
  apiFetch<StaffInviteResult>(`/employees/${id}/invite`, {
    method: "POST",
    body: { roleIds: [roleId] },
  })

/** A role of the school (`GET /roles`). */
export interface SchoolRole {
  id: string
  name: string
  isSystem: boolean
  permissions: string[]
}

/** Staff roles only: portal roles (guardians, students) aren't for staff. */
export const staffRolesQuery = () =>
  queryOptions({
    queryKey: onboardingKeys.roles,
    queryFn: async ({ signal }) =>
      (await apiFetch<SchoolRole[]>("/roles", { signal })).filter(
        (role) => !role.permissions.every((key) => key.startsWith("portal:"))
      ),
    staleTime: 5 * 60_000,
  })
