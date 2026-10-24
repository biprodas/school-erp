import { seal } from "~/lib/session/seal"
import type { TokenResponse } from "~/lib/session/tokens"
import type { Session } from "~/lib/session/types"

export const TEST_SECRET = "test-session-secret-0123456789abcdef"

const b64 = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString("base64url")

const nowSeconds = () => Math.floor(Date.now() / 1000)

/**
 * A JWT-shaped access token (unsigned: the frontend only decodes it). The
 * real ones are about this size.
 */
export function fakeAccessToken(
  claims: { sid?: string; exp?: number; sub?: string; orgId?: string } = {}
) {
  return [
    b64({ alg: "HS256", typ: "JWT" }),
    b64({
      sub: "user-1",
      orgId: "org-1",
      isAdmin: false,
      sid: "sid-1",
      iat: nowSeconds(),
      exp: nowSeconds() + 900,
      ...claims,
    }),
    "c2lnbmF0dXJlLW5vdC1jaGVja2VkLWJ5LXRoZS1mcm9udGVuZA",
  ].join(".")
}

export function tokenResponse(
  overrides: Partial<TokenResponse> & { exp?: number; sid?: string } = {}
): TokenResponse {
  const { exp, sid, ...rest } = overrides
  return {
    access_token: fakeAccessToken({
      ...(exp !== undefined && { exp }),
      ...(sid !== undefined && { sid }),
    }),
    refresh_token: "a".repeat(64),
    refresh_expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    mustChangePassword: false,
    user: {
      id: "user-1",
      email: "teacher@acme.test",
      phone: "+8801712345678",
      name: "Rafiq Teacher",
      roles: ["teacher"],
      isAdmin: false,
    },
    organization: { id: "org-1", slug: "acme" },
    ...rest,
  }
}

export function testSession(overrides: Partial<Session> = {}): Session {
  return {
    v: 1,
    realm: "tenant",
    at: fakeAccessToken(),
    sid: "sid-1",
    atExp: nowSeconds() + 900,
    rt: "r".repeat(64),
    rtExp: nowSeconds() + 30 * 86_400,
    orgId: "org-1",
    slug: "acme",
    user: {
      id: "user-1",
      name: "Rafiq Teacher",
      email: "teacher@acme.test",
      phone: "+8801712345678",
      roles: ["teacher"],
      isAdmin: false,
    },
    mustChangePassword: false,
    onboardingCompletedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  }
}

export const sealedSession = (overrides: Partial<Session> = {}) =>
  seal(testSession(overrides), TEST_SECRET)

/** A JSON response like the backend's. */
export const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  })

export const ok = (data: unknown, status = 200) =>
  json({ success: true, statusCode: status, message: "OK", data }, status)

export const failure = (status: number, code: string, message = code) =>
  json({ success: false, statusCode: status, message, code }, status)
