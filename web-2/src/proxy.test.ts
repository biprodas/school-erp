// @vitest-environment node
import {
  getRedirectUrl,
  getRewrittenUrl,
  isRewrite,
  // The docs call it `unstable_doesProxyMatch`; 16.4 still exports this name.
  unstable_doesMiddlewareMatch,
} from "next/experimental/testing/server"
import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { clearRefreshState } from "~/lib/auth/refresh"
import { unseal } from "~/lib/auth/seal"
import type { TenantLookup } from "~/lib/tenancy/tenant"
import {
  failure,
  ok,
  sealedSession,
  TEST_SECRET,
  tokenResponse,
} from "~/test/sessions"

const lookupTenant = vi.fn<() => Promise<TenantLookup>>()

vi.mock("~/lib/tenancy/tenant", () => ({ lookupTenant }))

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
  clearRefreshState()
})

afterEach(() => {
  vi.unstubAllGlobals()
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
    const response = await proxy(request("http://admin.lvh.me:3000/login"))
    expect(getRewrittenUrl(response)).toBe(
      "http://admin.lvh.me:3000/admin/login"
    )
    expect(forwarded(response, "x-host-kind")).toBe("admin")
  })

  it("gives every page a CSP with a fresh nonce, and passes the nonce on", async () => {
    const page = () =>
      proxy(request("http://lvh.me:3000/", { "x-nonce": "forged" }))
    const first = await page()
    const csp = first.headers.get("content-security-policy") ?? ""
    const nonce = forwarded(first, "x-nonce")
    expect(nonce).toBeTruthy()
    expect(nonce).not.toBe("forged")
    expect(csp).toContain(`'nonce-${nonce}'`)
    // Next.js reads the nonce from the request's CSP header.
    expect(forwarded(first, "content-security-policy")).toBe(csp)
    expect(forwarded(await page(), "x-nonce")).not.toBe(nonce)
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
        "x-request-origin": "http://victim-school.lvh.me:3000",
      })
    )

    expect(isRewrite(response)).toBe(true)
    expect(forwarded(response, "x-host-kind")).toBe("site")
    expect(forwarded(response, "x-tenant-slug")).toBeNull()
    expect(forwarded(response, "x-request-origin")).toBe("http://lvh.me:3000")
  })

  it("renders nothing for a request that claims a host kind", async () => {
    // Only Next's in-process redirect fetch carries it legitimately (below).
    const response = await proxy(
      request("http://lvh.me:3000/", { "x-host-kind": "school" })
    )
    expect(response.status).toBe(204)
    expect(isRewrite(response)).toBe(false)
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

describe("proxy session refresh", () => {
  const acme = { status: "found", slug: "acme", name: "Acme" } as const
  const page = (cookie: string) =>
    request("http://acme.lvh.me:3000/dashboard", {
      cookie: `locale=bn; school_erp_session=${cookie}`,
    })
  const nowSeconds = () => Math.floor(Date.now() / 1000)

  it("leaves a valid session alone", async () => {
    lookupTenant.mockResolvedValue(acme)
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const response = await proxy(page(await sealedSession()))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(response.headers.get("set-cookie")).toBeNull()
  })

  it("refreshes a session about to expire, for the browser and the page", async () => {
    lookupTenant.mockResolvedValue(acme)
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          ok(tokenResponse({ refresh_token: "n".repeat(64) }), 201)
        )
      )
    )

    const response = await proxy(
      page(await sealedSession({ atExp: nowSeconds() + 5 }))
    )

    // The browser gets the new cookie…
    const setCookie = response.headers.get("set-cookie") ?? ""
    const value = /school_erp_session=([^;]+)/.exec(setCookie)?.[1]
    await expect(unseal(value, TEST_SECRET)).resolves.toMatchObject({
      rt: "n".repeat(64),
    })
    // …and the page rendering after the proxy reads it already.
    const pageCookie = forwarded(response, "cookie") ?? ""
    expect(pageCookie).toContain(`school_erp_session=${value}`)
    expect(pageCookie).toContain("locale=bn")
  })

  it("drops a session the backend no longer accepts", async () => {
    lookupTenant.mockResolvedValue(acme)
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(failure(401, "REFRESH_TOKEN_REUSED")))
    )

    const response = await proxy(
      page(await sealedSession({ atExp: nowSeconds() - 5 }))
    )

    expect(response.headers.get("set-cookie")).toMatch(
      /school_erp_session=;.*Max-Age=0/i
    )
    // Signed out now, so the protected page sends them to sign in.
    expect(getRedirectUrl(response)).toBe(
      "http://acme.lvh.me:3000/login?next=%2Fdashboard"
    )
  })

  it("never reads a school session on the marketing site", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const response = await proxy(
      request("http://lvh.me:3000/", {
        cookie: `school_erp_session=${await sealedSession({ atExp: nowSeconds() - 5 })}`,
      })
    )

    expect(fetchMock).not.toHaveBeenCalled()
    expect(response.headers.get("set-cookie")).toBeNull()
  })
})

describe("proxy sign-in gates", () => {
  const acme = { status: "found", slug: "acme", name: "Acme" } as const
  const visit = async (
    path: string,
    session?: Parameters<typeof sealedSession>[0],
    method = "GET"
  ) => {
    lookupTenant.mockResolvedValue(acme)
    const headers: Record<string, string> = { host: "acme.lvh.me:3000" }
    if (session) {
      headers.cookie = `school_erp_session=${await sealedSession(session)}`
    }
    return proxy(
      new NextRequest(`http://acme.lvh.me:3000${path}`, { method, headers })
    )
  }

  it("sends signed-out visitors of protected pages to sign in, keeping the path", async () => {
    const response = await visit("/dashboard/students?page=2")
    expect(getRedirectUrl(response)).toBe(
      "http://acme.lvh.me:3000/login?next=%2Fdashboard%2Fstudents%3Fpage%3D2"
    )
  })

  it("lets signed-out visitors open public pages", async () => {
    for (const path of ["/", "/login", "/activate?token=x"]) {
      expect(isRewrite(await visit(path))).toBe(true)
    }
  })

  it("keeps a user with a temporary password on /change-password", async () => {
    const forced = { mustChangePassword: true }
    expect(getRedirectUrl(await visit("/dashboard", forced))).toBe(
      "http://acme.lvh.me:3000/change-password"
    )
    expect(isRewrite(await visit("/change-password", forced))).toBe(true)
    expect(isRewrite(await visit("/auth/handoff?code=x", forced))).toBe(true)
  })

  it("sends signed-in users from /login to their home", async () => {
    expect(getRedirectUrl(await visit("/login", {}))).toBe(
      "http://acme.lvh.me:3000/dashboard"
    )
  })

  it("leaves server actions to check for themselves", async () => {
    expect(isRewrite(await visit("/login", {}, "POST"))).toBe(true)
  })
})

describe("proxy and server-action redirects", () => {
  it("answers Next's in-process redirect fetch with nothing, so the client navigates", async () => {
    // What Next sends after `redirect("/")` in an admin-host action: the
    // rewritten headers, to its own origin.
    const response = await proxy(
      request("http://localhost:3000/", {
        "x-host-kind": "admin",
        "x-request-origin": "http://admin.lvh.me:3000",
      })
    )
    expect(response.status).toBe(204)
    expect(isRewrite(response)).toBe(false)
    expect(lookupTenant).not.toHaveBeenCalled()
  })
})

describe("proxy admin gate", () => {
  const platform = (overrides: Parameters<typeof sealedSession>[0] = {}) =>
    sealedSession({
      realm: "platform",
      orgId: null,
      slug: null,
      user: {
        id: "admin-1",
        name: "Super Admin",
        email: "admin@example.test",
        phone: null,
        roles: [],
        isAdmin: false,
        platformRole: "super_admin",
        permissions: ["console:access"],
      },
      ...overrides,
    })
  const visit = (path: string, cookie?: string) =>
    proxy(
      new NextRequest(`http://admin.lvh.me:3000${path}`, {
        headers: { host: "admin.lvh.me:3000", ...(cookie && { cookie }) },
      })
    )

  it("sends signed-out visitors to sign in, keeping the path", async () => {
    expect(getRedirectUrl(await visit("/schools?q=a"))).toBe(
      "http://admin.lvh.me:3000/login?next=%2Fschools%3Fq%3Da"
    )
    expect(isRewrite(await visit("/login"))).toBe(true)
    expect(isRewrite(await visit("/auth/handoff?code=x"))).toBe(true)
  })

  it("opens the console with the platform cookie, and sends /login home", async () => {
    const cookie = `school_erp_admin=${await platform()}`
    expect(getRewrittenUrl(await visit("/", cookie))).toBe(
      "http://admin.lvh.me:3000/admin"
    )
    expect(getRedirectUrl(await visit("/login", cookie))).toBe(
      "http://admin.lvh.me:3000/"
    )
  })

  it("treats a platform session without console access as none, so /login stays open", async () => {
    // E.g. a cookie from before platform roles, which carries no permissions.
    const cookie = `school_erp_admin=${await platform({
      user: {
        id: "old-1",
        name: "Old",
        email: "old@example.test",
        phone: null,
        roles: [],
        isAdmin: false,
        platformRole: null,
        permissions: [],
      },
    })}`
    expect(isRewrite(await visit("/login", cookie))).toBe(true)
    expect(getRedirectUrl(await visit("/", cookie))).toBe(
      "http://admin.lvh.me:3000/login?next=%2F"
    )
  })

  it("[tenant-isolation] never takes a school session for a platform one, or the reverse", async () => {
    // A school cookie on the admin host, even under the admin cookie name.
    expect(
      getRedirectUrl(
        await visit("/", `school_erp_admin=${await sealedSession()}`)
      )
    ).toBe("http://admin.lvh.me:3000/login?next=%2F")
    // The platform cookie on a school host is no session there.
    lookupTenant.mockResolvedValue({
      status: "found",
      slug: "acme",
      name: "Acme",
    })
    const school = await proxy(
      new NextRequest("http://acme.lvh.me:3000/student", {
        headers: {
          host: "acme.lvh.me:3000",
          cookie: `school_erp_admin=${await platform()}; school_erp_session=${await platform()}`,
        },
      })
    )
    expect(getRedirectUrl(school)).toBe(
      "http://acme.lvh.me:3000/login?next=%2Fstudent"
    )
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
