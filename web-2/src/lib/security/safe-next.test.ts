import { describe, expect, it } from "vitest"

import { safeNext } from "./safe-next"

describe("safeNext", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/dashboard/students?page=2#top", "/dashboard/students?page=2#top"],
    ["/student", "/student"],
    ["/dashboard/../student", "/student"],
    ["/authors", "/authors"],
    ["/apix", "/apix"],
  ])("allows the same-host path %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected)
  })

  it.each([
    ["absolute URL", "https://evil.example/dashboard"],
    ["protocol-relative URL", "//evil.example"],
    ["backslash trick", "/\\evil.example"],
    ["javascript URL", "javascript:alert(1)"],
    ["relative path", "dashboard"],
    ["control character", "/dash\nboard"],
    ["tab", "/\t/evil.example"],
    ["handoff route", "/auth/handoff?code=abc"],
    ["API route", "/api/auth/me"],
    ["API root", "/api"],
    ["empty", ""],
    ["missing", undefined],
    ["null", null],
    ["very long", `/${"a".repeat(3000)}`],
  ])("rejects a %s", (_label, input) => {
    expect(safeNext(input, "/fallback")).toBe("/fallback")
  })

  it("defaults the fallback to /", () => {
    expect(safeNext("https://evil.example")).toBe("/")
  })
})
