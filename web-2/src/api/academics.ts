import { queryOptions } from "@tanstack/react-query"

import { apiFetch, apiFetchPage } from "~/lib/api/client"
import { isApiError } from "~/lib/api/errors"

// Sessions, classes and sections (backend/src/modules/academic-years,
// classes, sections). Only what onboarding needs so far; the academics
// screens extend it.

export interface AcademicYear {
  id: string
  name: string
  code: string | null
  /** `YYYY-MM-DD`. */
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
  isActive: boolean
}

export interface SchoolClass {
  id: string
  name: string
  code: string | null
  level: number | null
  isActive: boolean
}

export interface Section {
  id: string
  academicYearId: string
  classId: string
  name: string
  capacity: number | null
  isActive: boolean
}

/** The backend's page size limit; setup lists fit in one page. */
const ALL = { page: 1, limit: 100 }

export const academicKeys = {
  currentSession: ["academics", "sessions", "current"] as const,
  classes: ["academics", "classes"] as const,
  sections: (academicYearId: string) =>
    ["academics", "sections", { academicYearId }] as const,
}

/** The session marked current, or null when there is none. */
export const currentSessionQuery = () =>
  queryOptions({
    queryKey: academicKeys.currentSession,
    queryFn: async ({ signal }) => {
      try {
        return await apiFetch<AcademicYear>("/academic-years/current", {
          signal,
        })
      } catch (error) {
        if (isApiError(error) && error.code === "NO_CURRENT_SESSION") {
          return null
        }
        throw error
      }
    },
  })

/** Classes by level, then name. */
export const classesQuery = () =>
  queryOptions({
    queryKey: academicKeys.classes,
    queryFn: async ({ signal }) =>
      (await apiFetchPage<SchoolClass>("/classes", { signal, query: ALL }))
        .items,
  })

export const sectionsQuery = (academicYearId: string) =>
  queryOptions({
    queryKey: academicKeys.sections(academicYearId),
    queryFn: async ({ signal }) =>
      (
        await apiFetchPage<Section>("/sections", {
          signal,
          query: { ...ALL, academicYearId },
        })
      ).items,
  })

export interface NewSession {
  name: string
  startDate: string
  endDate: string
  isCurrent?: boolean
}

export const createSession = (body: NewSession) =>
  apiFetch<AcademicYear>("/academic-years", { method: "POST", body })

export const createClass = (body: { name: string; level?: number }) =>
  apiFetch<SchoolClass>("/classes", { method: "POST", body })

export const createSection = (body: {
  academicYearId: string
  classId: string
  name: string
}) => apiFetch<Section>("/sections", { method: "POST", body })
