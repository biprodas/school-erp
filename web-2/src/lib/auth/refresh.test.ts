// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  failure,
  json,
  ok,
  sealedSession,
  TEST_SECRET,
  testSession,
  tokenResponse,
} from "~/test/sessions"

import { ensureFreshSession, replaceCookie } from "./fresh"
import {
  clearRefreshState,
  needsRefresh,
  refreshSession,
  RefreshUnavailableError,
} from "./refresh"
import { unseal } from "./seal"

const now = () => Math.floor(Date.now() / 1000)
const scope = { realm: "tenant", slug: "acme" } as const

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  clearRefreshState()
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const refreshed = (sid = "sid-1") =>
  ok(tokenResponse({ sid, refresh_token: "b".repeat(64) }), 201)

describe("needsRefresh", () => {
  it("is due within a minute of expiry", () => {
    expect(needsRefresh(testSession({ atExp: now() + 900 }))).toBe(false)
    expect(needsRefresh(testSession({ atExp: now() + 30 }))).toBe(true)
    expect(needsRefresh(testSession({ atExp: now() - 30 }))).toBe(true)
  })
})

describe("refreshSession", () => {
  it("posts the refresh token for the school and returns the new session", async () => {
    fetchMock.mockResolvedValue(refreshed())

    const next = await refreshSession(testSession(), {
      client: { ip: "203.0.113.9", userAgent: "Mozilla/5.0 (Android 14)" },
    })

    expect(next).toMatchObject({ rt: "b".repeat(64), slug: "acme" })
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit]
    expect(String(url)).toBe("http://api.test/api/auth/refresh")
    expect(JSON.parse(String(init.body))).toEqual({
      refreshToken: "r".repeat(64),
    })
    const headers = new Headers(init.headers)
    expect(headers.get("x-tenant-id")).toBe("acme")
    expect(headers.get("x-forwarded-for")).toBe("203.0.113.9")
    expect(headers.get("user-agent")).toBe("Mozilla/5.0 (Android 14)")
  })

  it("uses the platform endpoint, without a tenant, on the admin host", async () => {
    fetchMock.mockResolvedValue(
      ok(tokenResponse({ organization: undefined }), 201)
    )

    await refreshSession(
      testSession({ realm: "platform", slug: null, orgId: null })
    )

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit]
    expect(String(url)).toBe("http://api.test/api/platform/auth/refresh")
    expect(new Headers(init.headers).has("x-tenant-id")).toBe(false)
  })

  it("sends one request for concurrent refreshes of a session", async () => {
    fetchMock.mockResolvedValue(refreshed())
    const session = testSession()

    const results = await Promise.all([
      refreshSession(session),
      refreshSession(session),
      refreshSession(session),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(new Set(results.map((r) => r?.rt))).toEqual(
      new Set(["b".repeat(64)])
    )
  })

  it("answers a just-rotated refresh token with its replacement (no reuse)", async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(refreshed())
    const old = testSession()

    const first = await refreshSession(old)
    // A request that left the browser before the new cookie arrived.
    vi.advanceTimersByTime(10_000)
    await expect(refreshSession(old)).resolves.toEqual(first)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // After the grace window the old token goes to the backend again.
    vi.advanceTimersByTime(30_000)
    fetchMock.mockResolvedValue(failure(401, "REFRESH_TOKEN_REUSED"))
    await expect(refreshSession(old)).resolves.toBeNull()
  })

  it("returns null when the backend refuses the refresh token", async () => {
    fetchMock.mockResolvedValue(failure(401, "REFRESH_TOKEN_REUSED"))
    await expect(refreshSession(testSession())).resolves.toBeNull()
  })

  it("throws RefreshUnavailableError when the backend can't answer", async () => {
    fetchMock.mockResolvedValueOnce(json({ success: false }, 503))
    await expect(refreshSession(testSession())).rejects.toBeInstanceOf(
      RefreshUnavailableError
    )
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"))
    await expect(refreshSession(testSession())).rejects.toBeInstanceOf(
      RefreshUnavailableError
    )
  })
})

describe("ensureFreshSession", () => {
  it("keeps a valid session without calling the backend", async () => {
    const result = await ensureFreshSession(await sealedSession(), scope)
    expect(result.session?.user.id).toBe("user-1")
    expect(result.cookie).toEqual({ action: "keep" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("refreshes a session about to expire and returns the new cookie", async () => {
    fetchMock.mockResolvedValue(refreshed())

    const result = await ensureFreshSession(
      await sealedSession({ atExp: now() + 10 }),
      scope
    )

    expect(result.cookie.action).toBe("set")
    const value = result.cookie.action === "set" ? result.cookie.value : ""
    await expect(unseal(value, TEST_SECRET)).resolves.toMatchObject({
      rt: "b".repeat(64),
      // Kept from the old session (the refresh response doesn't carry it).
      onboardingCompletedAt: "2026-10-01T00:00:00.000Z",
    })
  })

  it("forces a refresh on request (after a 401)", async () => {
    fetchMock.mockResolvedValue(refreshed())
    const result = await ensureFreshSession(await sealedSession(), scope, {
      force: true,
    })
    expect(result.cookie.action).toBe("set")
  })

  it("clears the cookie when the refresh token is refused", async () => {
    fetchMock.mockResolvedValue(failure(401, "UNAUTHORIZED"))
    const result = await ensureFreshSession(
      await sealedSession({ atExp: now() - 5 }),
      scope
    )
    expect(result).toEqual({ session: null, cookie: { action: "clear" } })
  })

  it("keeps the session when the backend is down", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))
    const result = await ensureFreshSession(
      await sealedSession({ atExp: now() + 10 }),
      scope
    )
    expect(result.session).not.toBeNull()
    expect(result.cookie).toEqual({ action: "keep" })
  })

  it("ignores and clears a cookie of another school, realm or secret", async () => {
    const otherSchool = await sealedSession({ slug: "beta" })
    await expect(ensureFreshSession(otherSchool, scope)).resolves.toEqual({
      session: null,
      cookie: { action: "clear" },
    })
    const platform = await sealedSession({ realm: "platform", slug: null })
    await expect(ensureFreshSession(platform, scope)).resolves.toMatchObject({
      session: null,
    })
    await expect(ensureFreshSession("garbage", scope)).resolves.toMatchObject({
      session: null,
      cookie: { action: "clear" },
    })
  })

  it("does nothing without a cookie", async () => {
    await expect(ensureFreshSession(undefined, scope)).resolves.toEqual({
      session: null,
      cookie: { action: "keep" },
    })
  })
})

describe("replaceCookie", () => {
  it("replaces or removes one cookie and keeps the others", () => {
    const header = "locale=bn; school_erp_session=old; theme=dark"
    expect(replaceCookie(header, "school_erp_session", "new")).toBe(
      "locale=bn; theme=dark; school_erp_session=new"
    )
    expect(replaceCookie(header, "school_erp_session", null)).toBe(
      "locale=bn; theme=dark"
    )
    expect(replaceCookie(null, "school_erp_session", "v")).toBe(
      "school_erp_session=v"
    )
  })
})
