import { queryOptions } from "@tanstack/react-query"

import type { AttendanceTally } from "~/api/dashboards"
import { apiFetch } from "~/lib/api/client"

// The guardian and student portal (backend/src/modules/portal/). Every
// child route answers 404 for a student not linked to the user.

/** `PortalChild`: a child the user may see, with their current placement. */
export interface PortalChild {
  studentId: string
  name: string
  nameBn: string | null
  admissionNumber: string
  /** `self` for a student's own account. */
  relation: "guardian" | "self"
  enrollment: {
    id: string
    academicYearId: string
    classId: string
    className: string
    sectionId: string
    sectionName: string
    rollNo: string | null
  } | null
}

/** `GET /portal/schools`: the user's other schools with children there. */
export interface PortalSchool {
  orgId: string
  slug: string
  name: string
  host: string
  children: { studentId: string; name: string; className: string | null }[]
}

export type CountsAs = "present" | "absent" | "late" | "leave" | "half_day"

export interface PortalNotice {
  id: string
  title: string
  body: string
  publishAt: string
  pinned: boolean
  read: boolean
}

/** `GET /portal/children/:id/dashboard`. Money in minor units. */
export interface ChildDashboard {
  child: PortalChild
  attendance: {
    /** Today's record, or null when the register isn't taken. */
    today: {
      date: string
      status: string
      label: string
      labelBn: string
      countsAs: CountsAs
    } | null
    /** The session so far; null without an enrollment or session dates. */
    session: (AttendanceTally & { from: string; to: string }) | null
  }
  upcomingExams: {
    id: string
    name: string
    startDate: string | null
    endDate: string | null
  }[]
  dues: {
    outstanding: number
    nextDueDate: string | null
    nextDueAmount: number
  }
  notices: PortalNotice[]
}

export const portalKeys = {
  children: ["portal", "children"] as const,
  schools: ["portal", "schools"] as const,
  dashboard: (studentId: string) =>
    ["portal", "children", studentId, "dashboard"] as const,
}

export const childrenQuery = () =>
  queryOptions({
    queryKey: portalKeys.children,
    queryFn: ({ signal }) =>
      apiFetch<PortalChild[]>("/portal/children", { signal }),
    staleTime: 5 * 60_000,
  })

/** Other schools change rarely; asked for when the menu needs them. */
export const portalSchoolsQuery = () =>
  queryOptions({
    queryKey: portalKeys.schools,
    queryFn: ({ signal }) =>
      apiFetch<PortalSchool[]>("/portal/schools", { signal }),
    staleTime: 5 * 60_000,
  })

export const childDashboardQuery = (studentId: string) =>
  queryOptions({
    queryKey: portalKeys.dashboard(studentId),
    queryFn: ({ signal }) =>
      apiFetch<ChildDashboard>(
        `/portal/children/${encodeURIComponent(studentId)}/dashboard`,
        { signal }
      ),
    staleTime: 60_000,
  })

/** A one-time sign-in code for another school; open `redirectUrl`. */
export const portalHandoff = (orgId: string) =>
  apiFetch<{ redirectUrl: string }>("/portal/handoff", {
    method: "POST",
    body: { orgId },
  })

/** The child's name in the viewer's language. */
export const childName = (
  child: Pick<PortalChild, "name" | "nameBn">,
  locale: string
) => (locale === "bn" && child.nameBn) || child.name

/**
 * The child the URL asks for (`?child=`) when the user may see them, else
 * the first one.
 */
export function selectedChild(
  children: PortalChild[],
  requested: string | null | undefined
): PortalChild | null {
  return children.find((c) => c.studentId === requested) ?? children[0] ?? null
}
