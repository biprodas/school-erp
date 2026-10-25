import { describe, expect, it } from "vitest"

import { testSession } from "~/test/sessions"

import {
  adminDestination,
  adminGate,
  destinationAfterSignIn,
  gate,
  homeFor,
  isPortalUser,
} from "./home"
import type { Session } from "./types"

const user = (overrides: Partial<Session["user"]>) =>
  testSession({ user: { ...testSession().user, ...overrides } })

const admin = user({ isAdmin: true, roles: ["admin"] })
const teacher = user({ roles: ["teacher"] })
const guardian = user({ roles: ["guardian"] })
const forced = testSession({ mustChangePassword: true })
const open = { onboardingCompletedAt: null }

describe("homeFor", () => {
  it("follows the plan's table (4.5)", () => {
    expect(homeFor(forced)).toBe("/change-password")
    expect(homeFor({ ...admin, ...open })).toBe("/onboarding")
    expect(homeFor({ ...teacher, ...open })).toBe("/setting-up")
    expect(homeFor(guardian)).toBe("/student")
    expect(homeFor({ ...guardian, ...open })).toBe("/student")
    expect(homeFor(teacher)).toBe("/dashboard")
    expect(homeFor(admin)).toBe("/dashboard")
  })

  it("treats members without roles as staff", () => {
    expect(homeFor(user({ roles: [] }))).toBe("/dashboard")
  })
})

describe("isPortalUser", () => {
  it("needs every role to be a portal role", () => {
    expect(isPortalUser(guardian.user)).toBe(true)
    expect(isPortalUser(user({ roles: ["guardian", "student"] }).user)).toBe(
      true
    )
    expect(isPortalUser(user({ roles: ["guardian", "teacher"] }).user)).toBe(
      false
    )
    expect(isPortalUser(user({ roles: [] }).user)).toBe(false)
    expect(
      isPortalUser(user({ roles: ["guardian"], isAdmin: true }).user)
    ).toBe(false)
  })
})

describe("gate", () => {
  it("lets signed-out visitors open public pages only", () => {
    expect(gate(null, "/")).toBeNull()
    expect(gate(null, "/login")).toBeNull()
    expect(gate(null, "/reset-password?token=x")).toBeNull()
    expect(gate(null, "/dashboard")).toBe("/login?next=%2Fdashboard")
    expect(gate(null, "/student/attendance?child=1")).toBe(
      "/login?next=%2Fstudent%2Fattendance%3Fchild%3D1"
    )
    expect(gate(null, "/onboarding")).not.toBeNull()
    expect(gate(null, "/change-password")).not.toBeNull()
    expect(gate(null, "/setting-up")).not.toBeNull()
  })

  it("doesn't mistake look-alike paths for protected ones", () => {
    expect(gate(null, "/dashboards")).toBeNull()
    expect(gate(null, "/students")).toBeNull()
  })

  it("allows only the password change while one is required", () => {
    expect(gate(forced, "/change-password")).toBeNull()
    expect(gate(forced, "/auth/handoff?code=x")).toBeNull()
    for (const path of [
      "/",
      "/login",
      "/dashboard",
      "/student",
      "/setting-up",
    ]) {
      expect(gate(forced, path)).toBe("/change-password")
    }
  })

  it("sends signed-in users away from /login", () => {
    expect(gate(teacher, "/login")).toBe("/dashboard")
    expect(gate(guardian, "/login?next=/x")).toBe("/student")
  })

  it("holds staff on /setting-up while onboarding is open", () => {
    const waiting = { ...teacher, ...open }
    expect(gate(waiting, "/dashboard/students")).toBe("/setting-up")
    expect(gate(waiting, "/onboarding")).toBe("/setting-up")
    expect(gate(waiting, "/setting-up")).toBeNull()
    expect(gate(waiting, "/change-password")).toBeNull()
  })

  it("sends admins to /onboarding while it is open", () => {
    const owner = { ...admin, ...open }
    expect(gate(owner, "/dashboard")).toBe("/onboarding")
    expect(gate(owner, "/setting-up")).toBe("/onboarding")
    expect(gate(owner, "/onboarding")).toBeNull()
  })

  it("keeps portal users out of the staff app, onboarding or not", () => {
    expect(gate(guardian, "/dashboard")).toBe("/student")
    expect(gate({ ...guardian, ...open }, "/setting-up")).toBe("/student")
    expect(gate({ ...guardian, ...open }, "/student")).toBeNull()
  })

  it("closes /setting-up once onboarding is done", () => {
    expect(gate(teacher, "/setting-up")).toBe("/dashboard")
    expect(gate(teacher, "/dashboard")).toBeNull()
  })

  it("never redirects a page to itself", () => {
    const sessions = [admin, teacher, guardian, forced]
    for (const session of [
      ...sessions,
      ...sessions.map((s) => ({ ...s, ...open })),
    ]) {
      const home = homeFor(session)
      expect(gate(session, home)).toBeNull()
    }
  })
})

describe("destinationAfterSignIn", () => {
  it("uses a safe next the user may open", () => {
    expect(destinationAfterSignIn(teacher, "/dashboard/students?page=2")).toBe(
      "/dashboard/students?page=2"
    )
  })

  it("goes home for a missing, unsafe or closed next", () => {
    expect(destinationAfterSignIn(teacher, null)).toBe("/dashboard")
    expect(destinationAfterSignIn(teacher, "https://evil.test/")).toBe(
      "/dashboard"
    )
    expect(destinationAfterSignIn(teacher, "//evil.test")).toBe("/dashboard")
    expect(destinationAfterSignIn(teacher, "/login?next=/x")).toBe("/dashboard")
    expect(destinationAfterSignIn(guardian, "/dashboard")).toBe("/student")
    expect(destinationAfterSignIn(forced, "/dashboard")).toBe(
      "/change-password"
    )
    expect(
      destinationAfterSignIn({ ...admin, ...open }, "/dashboard/fees")
    ).toBe("/onboarding")
  })
})

describe("adminGate", () => {
  const platform = testSession({ realm: "platform", orgId: null, slug: null })

  it("lets only sign-in through without a session", () => {
    expect(adminGate(null, "/")).toBe("/login?next=%2F")
    expect(adminGate(null, "/schools?page=2")).toBe(
      "/login?next=%2Fschools%3Fpage%3D2"
    )
    expect(adminGate(null, "/login")).toBeNull()
    expect(adminGate(null, "/auth/handoff?code=x")).toBeNull()
  })

  it("sends a signed-in admin from /login to the console", () => {
    expect(adminGate(platform, "/login")).toBe("/")
    expect(adminGate(platform, "/schools")).toBeNull()
  })
})

it("adminDestination keeps a same-host next, never sign-in itself", () => {
  expect(adminDestination("/schools?q=a")).toBe("/schools?q=a")
  expect(adminDestination(null)).toBe("/")
  expect(adminDestination("/login")).toBe("/")
  expect(adminDestination("/auth/handoff?code=x")).toBe("/")
  expect(adminDestination("https://evil.test/")).toBe("/")
  expect(adminDestination("//evil.test/")).toBe("/")
})
