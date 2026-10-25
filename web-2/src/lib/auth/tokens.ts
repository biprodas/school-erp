import { decodeJwt } from "jose"

import type { Realm, Session } from "./types"

/**
 * `POST /auth/login|handoff|activate|refresh` and their platform versions
 * answer with this (AuthService / PlatformAuthService `tokenResponse`).
 */
export interface TokenResponse {
  access_token: string
  refresh_token: string
  refresh_expires_at: string
  mustChangePassword?: boolean
  user: {
    id: string
    email: string | null
    phone: string | null
    name: string | null
    roles?: string[]
    isAdmin?: boolean
    /** Platform realm only. */
    platformRole?: string
    permissions?: string[]
  }
  /** Tenant realm only. */
  organization?: { id: string; slug: string }
}

/** `sid` and `exp` of an access token the backend just issued. */
export function accessTokenClaims(accessToken: string): {
  sid: string
  exp: number
} {
  const { sid, exp } = decodeJwt(accessToken) as {
    sid?: unknown
    exp?: unknown
  }
  if (typeof sid !== "string" || typeof exp !== "number") {
    throw new Error("Access token without sid/exp")
  }
  return { sid, exp }
}

/**
 * A new session from a token response. `previous` keeps what the response
 * doesn't carry (`onboardingCompletedAt`, from `GET /auth/me`).
 */
export function fromTokenResponse(
  body: TokenResponse,
  realm: Realm,
  previous?: Pick<Session, "onboardingCompletedAt">
): Session {
  const { sid, exp } = accessTokenClaims(body.access_token)
  return {
    v: 1,
    realm,
    at: body.access_token,
    sid,
    atExp: exp,
    rt: body.refresh_token,
    rtExp: Math.floor(new Date(body.refresh_expires_at).getTime() / 1000),
    orgId: body.organization?.id ?? null,
    slug: body.organization?.slug ?? null,
    user: {
      id: body.user.id,
      name: body.user.name,
      email: body.user.email,
      phone: body.user.phone,
      roles: body.user.roles ?? [],
      isAdmin: body.user.isAdmin === true,
      platformRole: body.user.platformRole ?? null,
      permissions: body.user.permissions ?? [],
    },
    mustChangePassword: body.mustChangePassword === true,
    onboardingCompletedAt: previous?.onboardingCompletedAt ?? null,
  }
}

/**
 * `POST /auth/change-password` answers with a new access token only (the
 * refresh token stays): swap it in.
 */
export function withAccessToken(
  session: Session,
  accessToken: string
): Session {
  const { sid, exp } = accessTokenClaims(accessToken)
  return { ...session, at: accessToken, sid, atExp: exp }
}
