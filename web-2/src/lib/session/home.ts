import { safeNext } from "~/lib/safe-next"

import type { Session, SessionUser } from "./types"

/** Roles that only open the portal (`portal:*` keys), never the staff app. */
const PORTAL_ROLES = new Set(["guardian", "student"])

/** Paths that need a session; everything else on a school host is public. */
const PROTECTED_PATHS = [
  "/dashboard",
  "/student",
  "/onboarding",
  "/change-password",
  "/setting-up",
]

/** Staff-only paths, closed to portal users and while onboarding is open. */
const STAFF_PATHS = ["/dashboard"]

const under = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(`${p}/`))

/** Guardians and students: every role is a portal role. */
export const isPortalUser = (user: SessionUser) =>
  !user.isAdmin &&
  user.roles.length > 0 &&
  user.roles.every((role) => PORTAL_ROLES.has(role))

/**
 * Where a signed-in user belongs on a school host
 * (doc/frontend-implementation-plan.md 4.5).
 */
export function homeFor(session: Session): string {
  if (session.mustChangePassword) return "/change-password"
  if (isPortalUser(session.user)) return "/student"
  if (!session.onboardingCompletedAt) {
    return session.user.isAdmin ? "/onboarding" : "/setting-up"
  }
  return "/dashboard"
}

/**
 * Where a request for `path` (pathname plus search) on a school host has
 * to go instead, or null when it may proceed. Read from the session
 * snapshot alone, so `src/proxy.ts` decides without calling the backend;
 * every endpoint still checks for itself.
 */
export function gate(session: Session | null, path: string): string | null {
  const pathname = new URL(path, "http://gate.invalid").pathname

  if (!session) {
    return under(pathname, PROTECTED_PATHS)
      ? `/login?next=${encodeURIComponent(path)}`
      : null
  }

  if (session.mustChangePassword) {
    return under(pathname, ["/change-password", "/auth"])
      ? null
      : "/change-password"
  }

  if (pathname === "/login") return homeFor(session)

  const home = homeFor(session)
  if (isPortalUser(session.user)) {
    return under(pathname, [...STAFF_PATHS, "/onboarding", "/setting-up"])
      ? home
      : null
  }

  if (!session.onboardingCompletedAt) {
    // Admins finish onboarding; other staff wait on `/setting-up`.
    const closed = session.user.isAdmin
      ? [...STAFF_PATHS, "/setting-up"]
      : [...STAFF_PATHS, "/onboarding"]
    return under(pathname, closed) ? home : null
  }

  return under(pathname, ["/setting-up"]) ? home : null
}

/**
 * After signing in: `next` when it is a same-host path this user may open,
 * else their home.
 */
export function destinationAfterSignIn(
  session: Session,
  next: string | null | undefined
): string {
  const target = safeNext(next, "")
  if (!target || target === "/login" || target.startsWith("/login?")) {
    return homeFor(session)
  }
  return gate(session, target) === null ? target : homeFor(session)
}

/** Admin-host paths open without a session: sign-in and its handoff. */
const ADMIN_PUBLIC_PATHS = ["/login", "/auth"]

/**
 * The admin host's gate: everything but sign-in needs a platform session,
 * and a signed-in admin on `/login` goes to the console's home.
 */
export function adminGate(
  session: Session | null,
  path: string
): string | null {
  const pathname = new URL(path, "http://gate.invalid").pathname
  if (!session) {
    return under(pathname, ADMIN_PUBLIC_PATHS)
      ? null
      : `/login?next=${encodeURIComponent(path)}`
  }
  return pathname === "/login" ? "/" : null
}

/** After signing in on the admin host: a same-host `next`, else `/`. */
export function adminDestination(next: string | null | undefined): string {
  const target = safeNext(next, "")
  return !target ||
    under(new URL(target, "http://gate.invalid").pathname, ADMIN_PUBLIC_PATHS)
    ? "/"
    : target
}

/**
 * Where a server layout sends a user whose session the backend refused
 * (401): a route handler that deletes the cookie, then `/login`.
 */
export const sessionEndedPath = (next: string) =>
  `/auth/session-ended?next=${encodeURIComponent(next)}`
