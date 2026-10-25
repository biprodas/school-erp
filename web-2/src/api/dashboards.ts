import { queryOptions } from "@tanstack/react-query"

import { apiFetch } from "~/lib/api/client"

// Shapes of `DashboardService` (backend/src/modules/reports/services/
// dashboard.service.ts). Money is in minor units (poisha), as numbers.

/** `collectionBetween`: completed payments in a date range. */
export interface Collection {
  from: string
  to: string
  payments: number
  total: number
  /** `cash`, `cheque`, `card`, `bank_slip` → amount. */
  byChannel: Record<string, number>
}

export type AgingBucket = "current" | "0-30" | "31-60" | "61-90" | "90+"

export interface DuesTotals {
  students: number
  outstanding: number
  buckets: Record<AgingBucket, number>
}

/** Attendance counts; `percentage` is null when nothing was recorded. */
export interface AttendanceTally {
  days: number
  present: number
  absent: number
  late: number
  leave: number
  halfDay: number
  percentage: number | null
}

/** `GET /dashboards/admin` (`dashboard_admin:read`). */
export interface AdminDashboard {
  date: string
  enrollment: {
    total: number
    byClass: { classId: string; className: string; students: number }[]
  }
  /** Null without a current session. */
  attendanceToday:
    | (AttendanceTally & {
        enrolled: number
        sections: number
        submitted: number
        byClass: {
          classId: string
          className: string
          percentage: number | null
          submitted: number
          sections: number
        }[]
      })
    | null
  collection: { today: Collection; monthToDate: Collection }
  dues: DuesTotals
  staff: { active: number }
  upcoming: {
    kind: "holiday" | "exam"
    title: string
    date: string
    endDate: string | null
  }[]
}

/** `GET /dashboards/teacher` (`dashboard_teacher:read`). */
export interface TeacherDashboard {
  date: string
  sections: {
    sectionId: string
    sectionName: string
    classId: string
    className: string
    status: "submitted" | "pending" | "holiday"
    holiday: string | null
    registers: number
    submittedAt: string | null
    takenBy: string | null
  }[]
  pendingAttendance: number
  pendingMarkSheets: {
    id: string
    examId: string
    subjectName: string
    sectionId: string
    sectionName: string
  }[]
}

export type PaymentChannel = "cash" | "cheque" | "card" | "bank_slip"

/** `GET /dashboards/accountant` (`dashboard_accountant:read`). */
export interface AccountantDashboard {
  date: string
  collection: { today: Collection; monthToDate: Collection }
  dues: DuesTotals
  expenses: { monthToDate: number }
  recentPayments: {
    id: string
    amount: number
    channel: PaymentChannel
    status: "completed" | "reversed"
    receivedAt: string
    payer: string
  }[]
}

/** `GET /onboarding/checklist`. */
export interface OnboardingChecklist {
  steps: {
    key: string
    required: boolean
    available: boolean
    done: boolean
  }[]
  percentage: number
  canComplete: boolean
}

export const dashboardKeys = {
  admin: ["dashboards", "admin"] as const,
  teacher: ["dashboards", "teacher"] as const,
  accountant: ["dashboards", "accountant"] as const,
  checklist: ["onboarding", "checklist"] as const,
}

/** The backend caches dashboards for 60 s, so asking sooner gains nothing. */
const DASHBOARD_STALE_MS = 60_000

export const adminDashboardQuery = () =>
  queryOptions({
    queryKey: dashboardKeys.admin,
    queryFn: ({ signal }) =>
      apiFetch<AdminDashboard>("/dashboards/admin", { signal }),
    staleTime: DASHBOARD_STALE_MS,
  })

export const teacherDashboardQuery = () =>
  queryOptions({
    queryKey: dashboardKeys.teacher,
    queryFn: ({ signal }) =>
      apiFetch<TeacherDashboard>("/dashboards/teacher", { signal }),
    staleTime: DASHBOARD_STALE_MS,
  })

export const accountantDashboardQuery = () =>
  queryOptions({
    queryKey: dashboardKeys.accountant,
    queryFn: ({ signal }) =>
      apiFetch<AccountantDashboard>("/dashboards/accountant", { signal }),
    staleTime: DASHBOARD_STALE_MS,
  })

export const onboardingChecklistQuery = () =>
  queryOptions({
    queryKey: dashboardKeys.checklist,
    queryFn: ({ signal }) =>
      apiFetch<OnboardingChecklist>("/onboarding/checklist", { signal }),
    staleTime: DASHBOARD_STALE_MS,
  })
