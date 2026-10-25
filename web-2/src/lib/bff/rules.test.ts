import { describe, expect, it } from "vitest"

import type { ResolvedHost } from "~/lib/tenancy/resolve-host"

import { isForwardable, passesCsrfCheck, routeKey } from "./rules"

const school: ResolvedHost = {
  kind: "school",
  hostname: "acme.lvh.me",
  slug: "acme",
}
const admin: ResolvedHost = { kind: "admin", hostname: "admin.lvh.me" }
const site: ResolvedHost = { kind: "site", hostname: "lvh.me" }
const unknown: ResolvedHost = { kind: "unknown", hostname: "nope.lvh.me" }

describe("routeKey", () => {
  it("normalizes like the backend router matches", () => {
    expect(routeKey("Auth/Login/")).toBe("auth/login")
    expect(routeKey("auth//login")).toBe("auth/login")
    expect(routeKey("auth/%6Cogin")).toBe("auth/login")
    expect(routeKey("students/%E0%A6%95")).toBe("students/ক")
  })

  it("rejects dot segments and broken encoding", () => {
    expect(routeKey("students/../auth/login")).toBeNull()
    expect(routeKey("students/%2e%2e/auth")).toBeNull()
    expect(routeKey("students/%E0%A6")).toBeNull()
  })
})

describe("isForwardable", () => {
  it("forwards tenant and public routes from a school host", () => {
    expect(isForwardable(school, "auth/me")).toBe(true)
    expect(isForwardable(school, "students")).toBe(true)
    expect(isForwardable(school, "students/123/documents")).toBe(true)
    expect(isForwardable(school, "public/organizations/acme/home")).toBe(true)
    expect(isForwardable(school, "auth/schools/handoff")).toBe(true)
  })

  it("never forwards platform routes from a school host", () => {
    for (const path of [
      "platform/users",
      "organizations",
      "organizations/1",
      "memberships/me",
      "oauth/google/start",
      "metrics",
      "health",
      "dev/mail",
    ]) {
      expect(isForwardable(school, path), path).toBe(false)
    }
  })

  it("never forwards endpoints that hand out or end sessions", () => {
    for (const path of [
      "auth/login",
      "AUTH/LOGIN",
      "auth/login/",
      "auth/%6Cogin",
      "auth/refresh",
      "auth/handoff",
      "auth/activate",
      "auth/change-password",
      "auth/logout",
      "auth/logout-all",
    ]) {
      expect(isForwardable(school, path), path).toBe(false)
    }
    for (const path of [
      "platform/auth/login",
      "platform/auth/refresh",
      "platform/auth/handoff/exchange",
      "platform/auth/verify-email",
      "platform/auth/register",
    ]) {
      expect(isForwardable(admin, path), path).toBe(false)
    }
  })

  it("keeps the admin host to platform routes", () => {
    expect(isForwardable(admin, "platform/users")).toBe(true)
    expect(isForwardable(admin, "organizations/1")).toBe(true)
    expect(isForwardable(admin, "platform/auth/handoff")).toBe(true)
    expect(isForwardable(admin, "students")).toBe(false)
  })

  it("keeps the marketing site to public and OAuth routes", () => {
    expect(isForwardable(site, "public/signup")).toBe(true)
    expect(isForwardable(site, "oauth/google/callback")).toBe(true)
    expect(isForwardable(site, "auth/me")).toBe(false)
    expect(isForwardable(site, "publicity")).toBe(false)
  })

  it("forwards nothing for unknown hosts", () => {
    expect(isForwardable(unknown, "public/signup")).toBe(false)
  })
})

describe("passesCsrfCheck", () => {
  const host = "acme.lvh.me:3000"
  const headers = (init: Record<string, string>) => new Headers(init)

  it("lets safe methods through", () => {
    expect(passesCsrfCheck("GET", headers({}), host)).toBe(true)
    expect(passesCsrfCheck("HEAD", headers({}), host)).toBe(true)
  })

  it("needs our header on state-changing requests", () => {
    expect(passesCsrfCheck("POST", headers({}), host)).toBe(false)
    expect(
      passesCsrfCheck(
        "POST",
        headers({ "x-requested-with": "XMLHttpRequest" }),
        host
      )
    ).toBe(false)
    expect(
      passesCsrfCheck(
        "DELETE",
        headers({ "x-requested-with": "kampasy" }),
        host
      )
    ).toBe(true)
  })

  it("refuses another origin even with the header", () => {
    const withOrigin = (origin: string) =>
      headers({ "x-requested-with": "kampasy", origin })
    expect(
      passesCsrfCheck("POST", withOrigin("http://acme.lvh.me:3000"), host)
    ).toBe(true)
    expect(
      passesCsrfCheck("POST", withOrigin("http://beta.lvh.me:3000"), host)
    ).toBe(false)
    expect(passesCsrfCheck("POST", withOrigin("null"), host)).toBe(false)
  })
})
