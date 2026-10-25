// @vitest-environment node
import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { clearRefreshState } from "~/lib/auth/refresh"
import { unseal } from "~/lib/auth/seal"
import {
  failure,
  json,
  ok,
  sealedSession,
  TEST_SECRET,
  tokenResponse,
} from "~/test/sessions"

vi.mock("~/lib/tenancy/tenant", () => ({
  lookupTenant: vi.fn(() =>
    Promise.resolve({ status: "found", slug: "acme", name: "Acme" })
  ),
}))

const { handleBff } = await import("./handler")

const now = () => Math.floor(Date.now() / 1000)
const ORIGIN = "http://acme.lvh.me:3000"

/** Backend stub: `/auth/refresh` and the route under test, by path. */
let routes: Record<string, (init: RequestInit) => Response | Promise<Response>>
let calls: { path: string; init: RequestInit }[]

beforeEach(() => {
  clearRefreshState()
  calls = []
  routes = {}
  vi.stubGlobal(
    "fetch",
    vi.fn((url: URL, init: RequestInit) => {
      const path = url.pathname.replace(/^\/api/, "") + url.search
      calls.push({ path, init })
      const route = routes[path] ?? routes[url.pathname.replace(/^\/api/, "")]
      return Promise.resolve(route ? route(init) : failure(404, "NOT_FOUND"))
    })
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function request(
  path: string,
  init: {
    method?: string
    headers?: Record<string, string>
    body?: string
    cookie?: string
    host?: string
  } = {}
) {
  const host = init.host ?? "acme.lvh.me:3000"
  const headers: Record<string, string> = { host, ...init.headers }
  if (init.cookie)
    headers.cookie = `school_erp_session=${init.cookie}; locale=hi`
  return new NextRequest(`http://${host}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body,
  })
}

const backendHeaders = (n = 0) => new Headers(calls[n].init.headers)
const responseCookie = (response: Response) =>
  response.headers.get("set-cookie") ?? ""

describe("handleBff", () => {
  it("forwards with the session's bearer token and the school", async () => {
    routes["/auth/me"] = () => ok({ id: "user-1" })
    const cookie = await sealedSession()

    const response = await handleBff(
      await request("/api/auth/me", {
        cookie,
        headers: {
          authorization: "Bearer from-the-browser",
          "accept-language": "bn",
          // The client claims 1.2.3.4; the proxy in front appended the real one.
          "x-forwarded-for": "1.2.3.4, 203.0.113.9",
          "user-agent": "Mozilla/5.0 (Android 14)",
        },
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: { id: "user-1" },
    })
    const sent = backendHeaders()
    expect(sent.get("authorization")).toMatch(/^Bearer ey/)
    expect(sent.get("authorization")).not.toContain("from-the-browser")
    expect(sent.get("x-tenant-id")).toBe("acme")
    expect(sent.get("cookie")).toBeNull()
    expect(sent.get("accept-language")).toBe("bn")
    expect(sent.get("x-locale")).toBe("hi")
    expect(sent.get("x-forwarded-for")).toBe("203.0.113.9")
    expect(sent.get("user-agent")).toBe("Mozilla/5.0 (Android 14)")
    expect(sent.get("x-request-id")).toBeTruthy()
  })

  it("passes query strings, and only safe response headers", async () => {
    routes["/students?page=2&q=rafi"] = () =>
      json({ success: true, data: [] }, 200, {
        "set-cookie": "backend=1",
        "x-powered-by": "Express",
        "x-ratelimit-remaining": "99",
      })

    const response = await handleBff(
      await request("/api/students?page=2&q=rafi", {
        cookie: await sealedSession(),
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("set-cookie")).toBeNull()
    expect(response.headers.get("x-powered-by")).toBeNull()
    expect(response.headers.get("x-ratelimit-remaining")).toBe("99")
  })

  it("calls without a token when signed out, and passes the 401 through", async () => {
    routes["/auth/me"] = () => failure(401, "UNAUTHORIZED")

    const response = await handleBff(await request("/api/auth/me"))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      code: "UNAUTHORIZED",
    })
    expect(backendHeaders().has("authorization")).toBe(false)
  })

  it("refuses session endpoints, platform routes and unsafe requests without our header", async () => {
    const cookie = await sealedSession()

    const login = await handleBff(
      await request("/api/auth/login", {
        method: "POST",
        cookie,
        headers: {
          "x-requested-with": "kampasy",
          "content-type": "application/json",
        },
        body: "{}",
      })
    )
    expect(login.status).toBe(404)

    const platform = await handleBff(
      await request("/api/platform/users", { cookie })
    )
    expect(platform.status).toBe(404)

    const csrf = await handleBff(
      await request("/api/students", { method: "POST", cookie, body: "{}" })
    )
    expect(csrf.status).toBe(403)
    await expect(csrf.json()).resolves.toMatchObject({ code: "CSRF_REJECTED" })
    expect(calls).toHaveLength(0)
  })

  it("refreshes an access token about to expire, then sends the new one", async () => {
    const renewed = tokenResponse({ refresh_token: "n".repeat(64) })
    routes["/auth/refresh"] = () => ok(renewed, 201)
    routes["/auth/me"] = () => ok({ id: "user-1" })

    const response = await handleBff(
      await request("/api/auth/me", {
        cookie: await sealedSession({ atExp: now() + 5 }),
      })
    )

    expect(response.status).toBe(200)
    expect(calls.map((c) => c.path)).toEqual(["/auth/refresh", "/auth/me"])
    expect(backendHeaders(1).get("authorization")).toBe(
      `Bearer ${renewed.access_token}`
    )

    const cookie = /school_erp_session=([^;]+)/.exec(
      responseCookie(response)
    )?.[1]
    const stored = await unseal(cookie, TEST_SECRET)
    expect(stored?.rt).toBe("n".repeat(64))
    expect(responseCookie(response)).toMatch(/HttpOnly/i)
    expect(responseCookie(response)).toMatch(/SameSite=lax/i)
  })

  it("retries once after a refresh when the backend rejects the token early", async () => {
    let first = true
    routes["/auth/me"] = () => {
      if (first) {
        first = false
        return failure(401, "UNAUTHORIZED")
      }
      return ok({ id: "user-1" })
    }
    routes["/auth/refresh"] = () => ok(tokenResponse(), 201)

    const response = await handleBff(
      await request("/api/auth/me", { cookie: await sealedSession() })
    )

    expect(response.status).toBe(200)
    expect(calls.map((c) => c.path)).toEqual([
      "/auth/me",
      "/auth/refresh",
      "/auth/me",
    ])
    expect(responseCookie(response)).toContain("school_erp_session=")
  })

  it("replays a buffered JSON body on the retry", async () => {
    const bodies: string[] = []
    let first = true
    routes["/notices"] = (init) => {
      bodies.push(Buffer.from(init.body as ArrayBuffer).toString())
      if (first) {
        first = false
        return failure(401, "UNAUTHORIZED")
      }
      return ok({ id: "n1" }, 201)
    }
    routes["/auth/refresh"] = () => ok(tokenResponse(), 201)
    const payload = JSON.stringify({ title: "Holiday" })

    const response = await handleBff(
      await request("/api/notices", {
        method: "POST",
        cookie: await sealedSession(),
        headers: {
          "x-requested-with": "kampasy",
          origin: ORIGIN,
          "content-type": "application/json",
          "content-length": String(payload.length),
        },
        body: payload,
      })
    )

    expect(response.status).toBe(201)
    expect(bodies).toEqual([payload, payload])
  })

  it("ends the session when the refresh token is refused too", async () => {
    routes["/auth/me"] = () => failure(401, "UNAUTHORIZED")
    routes["/auth/refresh"] = () => failure(401, "REFRESH_TOKEN_REUSED")

    const response = await handleBff(
      await request("/api/auth/me", { cookie: await sealedSession() })
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      code: "SESSION_EXPIRED",
    })
    expect(responseCookie(response)).toMatch(/school_erp_session=;.*Max-Age=0/i)
  })

  it("ends a revoked session without trying to refresh", async () => {
    routes["/auth/me"] = () => failure(401, "SESSION_REVOKED")

    const response = await handleBff(
      await request("/api/auth/me", { cookie: await sealedSession() })
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      code: "SESSION_EXPIRED",
    })
    expect(calls.map((c) => c.path)).toEqual(["/auth/me"])
  })

  it("leaves other 401s (wrong password, …) alone", async () => {
    routes["/auth/identities/google"] = () =>
      failure(401, "INVALID_CREDENTIALS")

    const response = await handleBff(
      await request("/api/auth/identities/google", {
        method: "DELETE",
        cookie: await sealedSession(),
        headers: { "x-requested-with": "kampasy" },
      })
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_CREDENTIALS",
    })
    expect(responseCookie(response)).toBe("")
  })

  it("hands redirects (OAuth) to the browser instead of following them", async () => {
    routes["/oauth/google/start"] = () =>
      new Response(null, {
        status: 302,
        headers: {
          location: "https://accounts.google.com/o/oauth2/v2/auth?x=1",
        },
      })

    const response = await handleBff(
      await request("/api/oauth/google/start", { host: "lvh.me:3000" })
    )

    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toContain("accounts.google.com")
    expect(calls[0].init.redirect).toBe("manual")
  })

  it("answers 502 when the backend is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("fetch failed")))
    )

    const response = await handleBff(await request("/api/auth/me"))

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({
      code: "BAD_GATEWAY",
    })
  })
})
