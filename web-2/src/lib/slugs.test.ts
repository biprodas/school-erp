// @vitest-environment node
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import {
  isReservedSlug,
  isValidSlug,
  RESERVED_SLUGS,
  SLUG_PATTERN,
} from "./slugs"

const BACKEND_SLUGS = fileURLToPath(
  new URL("../../../backend/src/shared/slug/reserved-slugs.ts", import.meta.url)
)

describe("slug rules", () => {
  it("match the backend's (backend/src/shared/slug/reserved-slugs.ts)", () => {
    const source = readFileSync(BACKEND_SLUGS, "utf8")

    const list = /RESERVED_SLUGS[^=]*=\s*\[([^\]]*)\]/.exec(source)?.[1] ?? ""
    const backendReserved = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect(backendReserved.length).toBeGreaterThan(0)
    expect([...RESERVED_SLUGS].sort()).toEqual(backendReserved.sort())

    const pattern = /SLUG_PATTERN\s*=\s*\/(.+)\/;/.exec(source)?.[1]
    expect(SLUG_PATTERN.source).toBe(pattern)
  })

  it("accept 3–40 lower-case letters, digits and inner hyphens", () => {
    expect(isValidSlug("abc")).toBe(true)
    expect(isValidSlug("dhaka-ideal-2")).toBe(true)
    expect(isValidSlug("a".repeat(40))).toBe(true)
    expect(isValidSlug("ab")).toBe(false)
    expect(isValidSlug("a".repeat(41))).toBe(false)
    expect(isValidSlug("-abc")).toBe(false)
    expect(isValidSlug("Abc")).toBe(false)
    expect(isReservedSlug("admin")).toBe(true)
    expect(isReservedSlug("acme")).toBe(false)
  })
})
