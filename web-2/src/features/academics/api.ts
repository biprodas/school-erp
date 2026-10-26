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

export type ClassSubjectType = "compulsory" | "optional" | "fourth" | "elective"

/** A subject a class offers in a session (`GET /class-subjects`). */
export interface ClassSubject {
  id: string
  classId: string
  subjectId: string
  academicYearId: string
  subjectType: ClassSubjectType
  subject: { id: string; name: string; code: string | null }
  subjectGroup?: { id: string; name: string } | null
}

/** The backend's page size limit; setup lists fit in one page. */
const ALL = { page: 1, limit: 100 }

export const academicKeys = {
  currentSession: ["academics", "sessions", "current"] as const,
  classes: ["academics", "classes"] as const,
  sections: (academicYearId: string) =>
    ["academics", "sections", { academicYearId }] as const,
  classSubjects: (academicYearId: string) =>
    ["academics", "class-subjects", { academicYearId }] as const,
  holidays: (from: string, to: string) =>
    ["academics", "holidays", { from, to }] as const,
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

/** Name or dates; refused (409) when they overlap another session. */
export const updateSession = (id: string, body: Partial<NewSession>) =>
  apiFetch<AcademicYear>(`/academic-years/${id}`, { method: "PATCH", body })

/** A day or run of days without classes (`GET /holidays`). */
export interface Holiday {
  id: string
  name: string
  nameBn: string | null
  type: "public" | "school" | "religious"
  /** `YYYY-MM-DD`, inclusive. */
  dateFrom: string
  dateTo: string
}

export interface HolidayInput {
  name: string
  type: Holiday["type"]
  dateFrom: string
  /** Inclusive; defaults to `dateFrom`. */
  dateTo?: string
}

export const createHoliday = (body: HolidayInput) =>
  apiFetch<Holiday>("/holidays", { method: "POST", body })

export const updateHoliday = (id: string, body: Partial<HolidayInput>) =>
  apiFetch<Holiday>(`/holidays/${id}`, { method: "PATCH", body })

export const deleteHoliday = (id: string) =>
  apiFetch<void>(`/holidays/${id}`, { method: "DELETE" })

/** Holidays touching `from`–`to` (a session has well under 100). */
export const holidaysQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: academicKeys.holidays(from, to),
    queryFn: async ({ signal }) =>
      (
        await apiFetchPage<Holiday>("/holidays", {
          signal,
          query: { ...ALL, from, to },
        })
      ).items,
  })

export const createClass = (body: { name: string; level?: number }) =>
  apiFetch<SchoolClass>("/classes", { method: "POST", body })

export const createSection = (body: {
  academicYearId: string
  classId: string
  name: string
}) => apiFetch<Section>("/sections", { method: "POST", body })

/** Also removes its sections and class subjects; refused while in use. */
export const deleteClass = (id: string) =>
  apiFetch<void>(`/classes/${id}`, { method: "DELETE" })

/** Refused (409) while students are enrolled in it. */
export const deleteSection = (id: string) =>
  apiFetch<void>(`/sections/${id}`, { method: "DELETE" })

/**
 * Every class subject of a session. A curriculum template gives ten
 * classes a dozen subjects each, more than one page, so this reads them all.
 */
export const classSubjectsQuery = (academicYearId: string) =>
  queryOptions({
    queryKey: academicKeys.classSubjects(academicYearId),
    queryFn: async ({ signal }) => {
      const items: ClassSubject[] = []
      for (let page = 1; ; page++) {
        const result = await apiFetchPage<ClassSubject>("/class-subjects", {
          signal,
          query: { page, limit: ALL.limit, academicYearId },
        })
        items.push(...result.items)
        if (page >= result.meta.totalPages) return items
      }
    },
  })

export const deleteClassSubject = (id: string) =>
  apiFetch<void>(`/class-subjects/${id}`, { method: "DELETE" })
