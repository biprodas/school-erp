/**
 * The tenant realm signs in to one school; the platform realm is the admin
 * host (doc/domains-and-routing.md 5). Each has its own cookie.
 */
export type Realm = "tenant" | "platform"

export interface SessionUser {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  /** Role names in the school (empty on the platform). */
  roles: string[]
  /** School admin (tenant realm; false on the platform). */
  isAdmin: boolean
  /** Platform realm: the platform role (`support`, `super_admin`, …); null in a school. */
  platformRole: string | null
  /** Platform realm: what the role may do in the console (`console:access`, …). */
  permissions: string[]
}

/**
 * What the sealed session cookie holds. The tokens never reach browser
 * JavaScript: the cookie is HttpOnly and encrypted, and only server code
 * (the proxy, the BFF, server components and actions) reads it.
 */
export interface Session {
  v: 1
  realm: Realm
  /** Access token (JWT) and its `sid` (the backend session id). */
  at: string
  sid: string
  /** Access-token expiry, seconds since the epoch. */
  atExp: number
  /** Refresh token (rotated on every refresh) and its expiry in seconds. */
  rt: string
  rtExp: number
  /** The school the session belongs to (tenant realm only). */
  orgId: string | null
  slug: string | null
  user: SessionUser
  mustChangePassword: boolean
  /** From `GET /auth/me`; null until onboarding is done (or unknown). */
  onboardingCompletedAt: string | null
}
