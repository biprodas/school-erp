// @vitest-environment node
import { describe, expect, it } from "vitest"

import { TEST_SECRET, testSession, tokenResponse } from "~/test/sessions"

import { sessionCookieOptions } from "./cookie"
import { seal, unseal } from "./seal"
import { fromTokenResponse, withAccessToken } from "./tokens"

describe("seal / unseal", () => {
  it("round-trips a session", async () => {
    const session = testSession()
    const sealed = await seal(session, TEST_SECRET)

    expect(sealed.split(".")).toHaveLength(5) // compact JWE
    expect(sealed).not.toContain(session.rt) // encrypted, not just signed
    await expect(unseal(sealed, TEST_SECRET)).resolves.toMatchObject(session)
  })

  it("rejects a tampered value, another secret, missing input", async () => {
    const sealed = await seal(testSession(), TEST_SECRET)
    const parts = sealed.split(".")
    parts[3] = `${parts[3].slice(0, -2)}AA`

    await expect(unseal(parts.join("."), TEST_SECRET)).resolves.toBeNull()
    await expect(
      unseal(sealed, "another-secret-of-32-characters!")
    ).resolves.toBeNull()
    await expect(unseal("not-a-jwe", TEST_SECRET)).resolves.toBeNull()
    await expect(unseal(undefined, TEST_SECRET)).resolves.toBeNull()
  })

  it("rejects a session whose refresh token has expired", async () => {
    const expired = testSession({ rtExp: Math.floor(Date.now() / 1000) - 10 })
    await expect(
      unseal(await seal(expired, TEST_SECRET), TEST_SECRET)
    ).resolves.toBeNull()
  })

  it("rejects a payload of another shape", async () => {
    const old = { ...testSession(), v: 0 } as unknown as ReturnType<
      typeof testSession
    >
    await expect(
      unseal(await seal(old, TEST_SECRET), TEST_SECRET)
    ).resolves.toBeNull()
  })

  it("fits in a cookie with realistic tokens and a long name", async () => {
    const session = fromTokenResponse(
      tokenResponse({
        user: {
          id: crypto.randomUUID(),
          name: "মোহাম্মদ আব্দুর রহমান চৌধুরী (Mohammad Abdur Rahman Chowdhury)",
          email:
            "a.very.long.email.address.for.testing@dhaka-ideal-school.edu.bd",
          phone: "+8801712345678",
          roles: [
            "admin",
            "principal",
            "teacher",
            "class_teacher",
            "accountant",
          ],
          isAdmin: true,
        },
      }),
      "tenant"
    )
    const sealed = await seal(session, TEST_SECRET)
    // Browsers keep cookies up to 4096 bytes, name and attributes included.
    expect(sealed.length).toBeLessThan(3500)
  })
})

describe("fromTokenResponse", () => {
  it("maps the backend token response, keeping onboarding state", () => {
    const exp = Math.floor(Date.now() / 1000) + 900
    const body = tokenResponse({ exp, sid: "sid-42" })

    const session = fromTokenResponse(body, "tenant", {
      onboardingCompletedAt: "2026-10-01T00:00:00.000Z",
    })

    expect(session).toMatchObject({
      v: 1,
      realm: "tenant",
      at: body.access_token,
      sid: "sid-42",
      atExp: exp,
      rt: body.refresh_token,
      orgId: "org-1",
      slug: "acme",
      user: { id: "user-1", roles: ["teacher"], isAdmin: false },
      mustChangePassword: false,
      onboardingCompletedAt: "2026-10-01T00:00:00.000Z",
    })
    expect(session.rtExp).toBe(
      Math.floor(new Date(body.refresh_expires_at).getTime() / 1000)
    )
  })

  it("handles the platform shape (no organization, no roles)", () => {
    const body = tokenResponse({ organization: undefined })
    body.user = { ...body.user, roles: undefined, isAdmin: true }

    expect(fromTokenResponse(body, "platform")).toMatchObject({
      realm: "platform",
      orgId: null,
      slug: null,
      user: { roles: [], isAdmin: true },
      onboardingCompletedAt: null,
    })
  })

  it("swaps in a new access token after a password change", () => {
    const next = tokenResponse({
      sid: "sid-1",
      exp: 2_000_000_000,
    }).access_token
    expect(withAccessToken(testSession(), next)).toMatchObject({
      at: next,
      atExp: 2_000_000_000,
    })
  })
})

describe("sessionCookieOptions", () => {
  it("is host-only, HttpOnly, Lax, and lasts as long as the refresh token", () => {
    const now = Date.now()
    const options = sessionCookieOptions(
      { rtExp: Math.floor(now / 1000) + 3600 },
      now
    )
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
    })
    expect(options).not.toHaveProperty("domain")
  })
})
