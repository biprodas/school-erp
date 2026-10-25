import { describe, expect, it } from "vitest"

import {
  allows,
  can,
  canAny,
  NO_PERMISSIONS,
  toPermissions,
} from "./permissions"

describe("permissions", () => {
  const teacher = toPermissions({
    isAdmin: false,
    permissions: ["attendance:take", "students:read"],
  })
  const admin = toPermissions({ isAdmin: true, permissions: [] })

  it("checks one key or any of several", () => {
    expect(can(teacher, "attendance:take")).toBe(true)
    expect(can(teacher, "fees:collect")).toBe(false)
    expect(canAny(teacher, ["fees:collect", "students:read"])).toBe(true)
    expect(canAny(teacher, [])).toBe(false)
  })

  it("lets school admins pass every check", () => {
    expect(can(admin, "fees:collect")).toBe(true)
    expect(allows(admin, { adminOnly: true })).toBe(true)
  })

  it("applies a requirement", () => {
    expect(allows(teacher, {})).toBe(true)
    expect(allows(teacher, { permission: "students:read" })).toBe(true)
    expect(allows(teacher, { permission: ["x:y", "students:read"] })).toBe(true)
    expect(allows(teacher, { adminOnly: true })).toBe(false)
    expect(
      allows(teacher, { adminOnly: true, permission: "students:read" })
    ).toBe(false)
  })

  it("grants nothing before the member is known", () => {
    expect(toPermissions(null)).toBe(NO_PERMISSIONS)
    expect(can(NO_PERMISSIONS, "students:read")).toBe(false)
    expect(allows(NO_PERMISSIONS, {})).toBe(true)
  })
})
