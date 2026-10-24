// @vitest-environment node
import {
  getRedirectUrl,
  getRewrittenUrl,
  isRewrite,
  // The docs call it `unstable_doesProxyMatch`; 16.4 still exports this name.
  unstable_doesMiddlewareMatch,
} from "next/experimental/testing/server"
import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { TenantLookup } from "~/lib/tenant"

const lookupTenant = vi.fn<() => Promise<TenantLookup>>()

vi.mock("~/lib/tenant", () => ({ lookupTenant }))
vi.mock("~/lib/env", () => ({
  serverEnv: () => ({ API_URL: "http://api.test", SESSION_SECRET: "x" }),
}))

const { config, proxy } = await import("./proxy")

function request(url: string, headers: Record<string, string> = {}) {
  const { host } = new URL(url)
  return new NextRequest(url, { headers: { host, ...headers } })
}

/** A header the proxy passed on to the rewritten request. */
const forwarded = (response: Response, name: string) =>
  response.headers.get(`x-middleware-request-${name}`)

beforeEach(() => {
  lookupTenant.mockReset()
})

describe("proxy", () => {
  it("rewrites the apex into the site tree", async () => {
    const home = await proxy(request("http://lvh.me:3000/"))
    expect(getRewrittenUrl(home)).toBe("http://lvh.me:3000/site")

    const page = await proxy(request("http://lvh.me:3000/design-system?x=1"))
    expect(getRewrittenUrl(page)).toBe(
      "http://lvh.me:3000/site/design-system?x=1"
    )
    expect(forwarded(page, "x-host-kind")).toBe("site")
    expect(lookupTenant).not.toHaveBeenCalled()
  })

  it("rewrites the admin host into the admin tree", async () => {
    const response = await proxy(request("http://admin.lvh.me:3000/schools"))
    expect(getRewrittenUrl(response)).toBe(
      "http://admin.lvh.me:3000/admin/schools"
    )
    expect(forwarded(response, "x-host-kind")).toBe("admin")
  })

  it("rewrites a school host into the school tree with its slug", async () => {
    lookupTenant.mockResolvedValue({
      status: "found",
      slug: "acme",
      name: "Acme",
    })

    const response = await proxy(
      request("http://acme.lvh.me:3000/login?next=/x")
    )

    expect(getRewrittenUrl(response)).toBe(
      "http://acme.lvh.me:3000/school/login?next=/x"
    )
    expect(forwarded(response, "x-host-kind")).toBe("school")
    expect(forwarded(response, "x-tenant-slug")).toBe("acme")
    expect(forwarded(response, "x-request-origin")).toBe(
      "http://acme.lvh.me:3000"
    )
    expect(lookupTenant).toHaveBeenCalledWith(
      { kind: "school", hostname: "acme.lvh.me", slug: "acme" },
      { apiUrl: "http://api.test" }
    )
  })

  it("serves a custom domain as its school", async () => {
    lookupTenant.mockResolvedValue({
      status: "found",
      slug: "acme",
      name: "Acme",
    })

    const response = await proxy(request("https://erp.acme-school.com/"))

    expect(getRewrittenUrl(response)).toBe("https://erp.acme-school.com/school")
    expect(forwarded(response, "x-host-kind")).toBe("school")
    expect(forwarded(response, "x-tenant-slug")).toBe("acme")
  })

  it("redirects an old slug to the current one, keeping path and query", async () => {
    lookupTenant.mockResolvedValue({ status: "moved", slug: "acme-high" })

    const response = await proxy(
      request("http://acme.lvh.me:3000/login?next=/x")
    )

    expect(response.status).toBe(301)
    expect(getRedirectUrl(response)).toBe(
      "http://acme-high.lvh.me:3000/login?next=/x"
    )
  })

  it("shows the unknown-school page for hosts we don't serve", async () => {
    lookupTenant.mockResolvedValue({ status: "not-found" })
    const unknownSlug = await proxy(request("http://nope.lvh.me:3000/login"))
    expect(getRewrittenUrl(unknownSlug)).toBe(
      "http://nope.lvh.me:3000/unknown-school"
    )
    // Marked unknown, so `app/not-found.tsx` says the school wasn't found.
    expect(forwarded(unknownSlug, "x-host-kind")).toBe("unknown")
    expect(forwarded(unknownSlug, "x-tenant-slug")).toBeNull()

    // Reserved slugs never reach the backend.
    const reserved = await proxy(request("http://api.lvh.me:3000/"))
    expect(getRewrittenUrl(reserved)).toBe(
      "http://api.lvh.me:3000/unknown-school"
    )
    expect(forwarded(reserved, "x-host-kind")).toBe("unknown")
    expect(lookupTenant).toHaveBeenCalledTimes(1)
  })

  it("shows the unavailable page when the backend can't answer", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    lookupTenant.mockRejectedValue(new Error("down"))

    const response = await proxy(request("http://acme.lvh.me:3000/"))

    expect(getRewrittenUrl(response)).toBe(
      "http://acme.lvh.me:3000/unavailable"
    )
  })

  it("makes the internal trees unreachable by prefixing every path", async () => {
    lookupTenant.mockResolvedValue({
      status: "found",
      slug: "acme",
      name: "Acme",
    })

    const site = await proxy(request("http://lvh.me:3000/school/login"))
    expect(getRewrittenUrl(site)).toBe("http://lvh.me:3000/site/school/login")

    const school = await proxy(request("http://acme.lvh.me:3000/admin"))
    expect(getRewrittenUrl(school)).toBe("http://acme.lvh.me:3000/school/admin")
  })

  it("drops host headers sent by the client", async () => {
    const response = await proxy(
      request("http://lvh.me:3000/", {
        "x-tenant-slug": "victim-school",
        "x-host-kind": "school",
      })
    )

    expect(isRewrite(response)).toBe(true)
    expect(forwarded(response, "x-host-kind")).toBe("site")
    expect(forwarded(response, "x-tenant-slug")).toBeNull()
  })

  it("takes the protocol from X-Forwarded-Proto behind a TLS proxy", async () => {
    lookupTenant.mockResolvedValue({ status: "moved", slug: "new" })

    // TLS ends at the reverse proxy, which talks plain http to Next.
    const response = await proxy(
      request("http://old.lvh.me/notices", { "x-forwarded-proto": "https" })
    )
    expect(getRedirectUrl(response)).toBe("https://new.lvh.me/notices")
  })
})

describe("proxy matcher", () => {
  const matches = (url: string) =>
    unstable_doesMiddlewareMatch({ config, url, nextConfig: {} })

  it("runs on pages", () => {
    expect(matches("/")).toBe(true)
    expect(matches("/login")).toBe(true)
    expect(matches("/dashboard/students")).toBe(true)
  })

  it("skips the BFF, Next internals and files", () => {
    expect(matches("/api/auth/me")).toBe(false)
    expect(matches("/_next/static/chunks/main.js")).toBe(false)
    expect(matches("/icon.svg")).toBe(false)
    expect(matches("/apple-icon")).toBe(false)
    expect(matches("/robots.txt")).toBe(false)
  })
})
