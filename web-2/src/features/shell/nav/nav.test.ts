// @vitest-environment node
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { NAV, type NavCategory } from "~/features/shell/nav/config"

import en from "../../../../messages/en.json"

import { activeHref, navTrail, pageLabel, searchNav, visibleNav } from "./nav"
import { NO_PERMISSIONS, toPermissions } from "~/features/access/permissions"

const BACKEND_CATALOG = fileURLToPath(
  new URL(
    "../../../../../backend/src/modules/rbac/permissions.catalog.ts",
    import.meta.url
  )
)

// Keys of the seeded system roles (backend/src/modules/rbac/system-roles.seed.ts).
const TEACHER = [
  "academic_years:read",
  "terms:read",
  "shifts:read",
  "rooms:read",
  "classes:read",
  "sections:read",
  "subjects:read",
  "subject_groups:read",
  "class_subjects:read",
  "class_subject_groups:read",
  "class_teachers:read",
  "subject_teachers:read",
  "students:read",
  "enrollments:read",
  "student_subjects:read",
  "student_documents:read",
  "student_notes:read",
  "guardians:read",
  "attendance:read",
  "attendance:take",
  "holidays:read",
  "student_leaves:read",
  "grading_systems:read",
  "exams:read",
  "results:read",
  "results:enter",
  "notices:read",
  "notices:manage",
  "dashboard_teacher:read",
]

const ACCOUNTANT = [
  "academic_years:read",
  "classes:read",
  "sections:read",
  "students:read",
  "enrollments:read",
  "student_subjects:read",
  "guardians:read",
  "departments:read",
  "designations:read",
  "employees:read",
  "fees:read",
  "fees:setup",
  "fees:bill",
  "fees:collect",
  "fees:cancel_receipt",
  "fees:adjust",
  "fees:approve_waiver",
  "expenses:manage",
  "ledger:read",
  "notices:read",
  "dashboard_accountant:read",
]

const member = (permissions: string[], isAdmin = false) =>
  toPermissions({ isAdmin, permissions })

/** `{ category: { menu: [items] } }`, to compare whole sidebars. */
const shape = (nav: NavCategory[]) =>
  Object.fromEntries(
    nav.map((category) => [
      category.id,
      Object.fromEntries(
        category.menus.map((menu) => [
          menu.id,
          menu.items?.map((item) => item.id) ?? [],
        ])
      ),
    ])
  )

const label = (id: string) => (en.nav.labels as Record<string, string>)[id]

describe("visibleNav", () => {
  it("shows a school admin every menu, even without keys", () => {
    expect(shape(visibleNav(member([], true)))).toEqual(shape(NAV))
  })

  it("shows a teacher their teaching menus only", () => {
    expect(shape(visibleNav(member(TEACHER)))).toEqual({
      overview: { dashboard: [] },
      academics: {
        academicSetup: [
          "sessions",
          "classes",
          "subjects",
          "curriculum",
          "teacherAssignments",
          "shiftsRooms",
        ],
        attendance: [
          "takeAttendance",
          "registers",
          "leaveRequests",
          "holidays",
        ],
        exams: ["examList", "markEntry", "results", "grading"],
      },
      people: { students: ["studentDirectory"], guardians: [] },
      communication: { notices: [] },
    })
  })

  it("shows an accountant finance, the directories and their lookups", () => {
    expect(shape(visibleNav(member(ACCOUNTANT)))).toEqual({
      overview: { dashboard: [] },
      academics: { academicSetup: ["sessions", "classes"] },
      people: {
        students: ["studentDirectory"],
        guardians: [],
        staff: ["staffDirectory", "departments", "designations"],
      },
      finance: {
        fees: ["collectFees", "invoices", "payments", "feeSetup", "approvals"],
        expenses: [],
        ledger: [],
      },
      communication: { notices: [] },
    })
  })

  it("leaves a member without keys only the dashboard", () => {
    expect(shape(visibleNav(NO_PERMISSIONS))).toEqual({
      overview: { dashboard: [] },
    })
  })

  it("keeps admin-only items from members holding every key", () => {
    const everyKey = NAV.flatMap((c) => c.menus)
      .flatMap((m) => [m, ...(m.items ?? [])])
      .flatMap((entry) => entry.permission ?? [])
    const settings = visibleNav(member(everyKey))
      .flatMap((c) => c.menus)
      .find((m) => m.id === "settings")
    expect(settings?.items?.map((item) => item.id)).toEqual([
      "schoolSettings",
      "domains",
    ])
  })

  it("hides a menu once its last key is taken away", () => {
    const without = TEACHER.filter((key) => key !== "notices:read")
    expect(shape(visibleNav(member(without))).communication).toBeUndefined()
  })
})

describe("activeHref", () => {
  it("picks the longest link covering the path", () => {
    expect(activeHref("/dashboard/students/new")).toBe(
      "/dashboard/students/new"
    )
    expect(activeHref("/dashboard/students/123")).toBe("/dashboard/students")
    expect(activeHref("/dashboard/exams/marks/abc")).toBe(
      "/dashboard/exams/marks"
    )
  })

  it("matches the dashboard home only exactly", () => {
    expect(activeHref("/dashboard")).toBe("/dashboard")
    expect(activeHref("/dashboard/")).toBe("/dashboard")
    expect(activeHref("/dashboard/account")).toBeNull()
  })

  it("only considers the links it is given", () => {
    const teacherNav = visibleNav(member(TEACHER))
    expect(activeHref("/dashboard/students/new", teacherNav)).toBe(
      "/dashboard/students"
    )
  })
})

describe("navTrail and pageLabel", () => {
  it("names the menu and the page", () => {
    expect(navTrail("/dashboard/fees/collect")).toEqual([
      { id: "fees", href: null },
      { id: "collectFees", href: "/dashboard/fees/collect" },
    ])
    expect(navTrail("/dashboard/guardians")).toEqual([
      { id: "guardians", href: "/dashboard/guardians" },
    ])
    expect(navTrail("/dashboard/account/sessions")).toEqual([
      { id: "account", href: "/dashboard/account" },
    ])
    expect(navTrail("/dashboard/nowhere")).toEqual([])
  })

  it("labels exact sidebar paths only", () => {
    expect(pageLabel("/dashboard/notices")).toBe("notices")
    expect(pageLabel("/dashboard/notices/")).toBe("notices")
    expect(pageLabel("/dashboard/account")).toBe("account")
    expect(pageLabel("/dashboard/notices/123")).toBeNull()
  })
})

describe("searchNav", () => {
  const nav = visibleNav(member([], true))

  it("keeps matching items, ignoring case", () => {
    expect(shape(searchNav(nav, "INVOI", label))).toEqual({
      finance: { fees: ["invoices"] },
    })
  })

  it("keeps every item of a menu whose label matches", () => {
    expect(shape(searchNav(nav, "staff", label)).people).toEqual({
      staff: ["staffDirectory", "departments", "designations"],
    })
  })

  it("returns everything for a blank query and nothing for no match", () => {
    expect(searchNav(nav, "  ", label)).toBe(nav)
    expect(searchNav(nav, "zzz", label)).toEqual([])
  })

  it("searches the labels it is given (the viewer's language)", () => {
    const bangla = (id: string) => (id === "holidays" ? "ছুটির দিন" : id)
    expect(shape(searchNav(nav, "ছুটি", bangla))).toEqual({
      academics: { attendance: ["holidays"] },
    })
  })
})

describe("NAV", () => {
  const entries = NAV.flatMap((c) => c.menus).flatMap((m) => [
    m,
    ...(m.items ?? []),
  ])

  it("names only permission keys the backend has", () => {
    const source = readFileSync(BACKEND_CATALOG, "utf8")
    const catalog = new Set(
      [...source.matchAll(/:\s*'([a-z_]+:[a-z_]+)'/g)].map((m) => m[1])
    )
    expect(catalog.size).toBeGreaterThan(100)
    const unknown = entries
      .flatMap((entry) => entry.permission ?? [])
      .filter((key) => !catalog.has(key))
    expect(unknown).toEqual([])
  })

  it("has a unique /dashboard href and an English label for every link", () => {
    const hrefs = entries.flatMap((entry) =>
      "href" in entry && entry.href ? [entry.href] : []
    )
    expect(new Set(hrefs).size).toBe(hrefs.length)
    for (const href of hrefs) expect(href).toMatch(/^\/dashboard(\/|$)/)
    for (const entry of entries) expect(label(entry.id), entry.id).toBeTruthy()
  })
})
