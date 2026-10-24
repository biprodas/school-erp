import type { Realm, Session } from "./types"

/** One cookie per realm; school hosts and the admin host never share one. */
export const SESSION_COOKIES: Record<Realm, string> = {
  tenant: "kampasy_session",
  platform: "kampasy_admin",
}

export interface SessionCookieOptions {
  httpOnly: true
  secure: boolean
  sameSite: "lax"
  path: "/"
  maxAge: number
}

/**
 * Host-only (no `Domain`): each school host, subdomain or custom domain
 * keeps its own session (doc/domains-and-routing.md 5). Lives as long as
 * the refresh token.
 */
export function sessionCookieOptions(
  session: Pick<Session, "rtExp">,
  now = Date.now()
): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(0, session.rtExp - Math.floor(now / 1000)),
  }
}

/** Options that delete the cookie. */
export const expiredCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 0,
} as const
