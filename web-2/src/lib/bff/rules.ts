import { CSRF_HEADER, CSRF_VALUE } from "~/lib/api/client"
import type { ResolvedHost } from "~/lib/tenancy/resolve-host"

/**
 * Backend endpoints that answer with tokens, or that start, rotate or end
 * a session. The BFF never forwards them: tokens must not reach browser
 * JavaScript, and sign-in goes through server actions and route handlers
 * that store the tokens in the sealed cookie instead.
 */
const SESSION_PATHS = new Set([
  "auth/login",
  "auth/refresh",
  "auth/handoff",
  "auth/activate",
  "auth/change-password",
  "auth/logout",
  "auth/logout-all",
  "platform/auth/register",
  "platform/auth/login",
  "platform/auth/refresh",
  "platform/auth/handoff/exchange",
  "platform/auth/verify-email",
  "platform/auth/change-password",
  "platform/auth/logout",
  "platform/auth/logout-all",
])

/** Platform-realm routes (outside TenantMiddleware); never from a school host. */
const PLATFORM_PREFIXES = [
  "platform",
  "organizations",
  "memberships",
  "oauth",
  "metrics",
  "health",
  "dev",
]

/** What the marketing site and the admin host may reach. */
const SITE_PREFIXES = ["public", "oauth"]
const ADMIN_PREFIXES = [
  "platform",
  "organizations",
  "memberships",
  "public",
  "oauth",
]

/**
 * The path as the backend's router sees it: decoded, lower-case (Express
 * matches case-insensitively), no empty segments or trailing slash.
 * Null for paths that don't decode, or with `.`/`..` segments.
 */
export function routeKey(path: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(path)
  } catch {
    return null
  }
  const segments = decoded.toLowerCase().split("/").filter(Boolean)
  if (segments.some((s) => s === "." || s === "..")) return null
  return segments.join("/")
}

const under = (key: string, prefixes: string[]) =>
  prefixes.some((p) => key === p || key.startsWith(`${p}/`))

/** Whether the BFF forwards `path` (after `/api/`) from this host. */
export function isForwardable(host: ResolvedHost, path: string): boolean {
  const key = routeKey(path)
  if (!key || SESSION_PATHS.has(key)) return false
  switch (host.kind) {
    case "school":
      return !under(key, PLATFORM_PREFIXES)
    case "admin":
      return under(key, ADMIN_PREFIXES)
    case "site":
      return under(key, SITE_PREFIXES)
    default:
      return false
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

/**
 * CSRF check for state-changing requests: the session cookie is
 * `SameSite=Lax`, and on top of that the request must carry our custom
 * header (a cross-site form or image can't) and, when the browser sends
 * one, an `Origin` on this host.
 */
export function passesCsrfCheck(
  method: string,
  headers: Headers,
  host: string
): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return true
  if (headers.get(CSRF_HEADER) !== CSRF_VALUE) return false
  const origin = headers.get("origin")
  if (!origin) return true
  try {
    return new URL(origin).host === host.toLowerCase()
  } catch {
    return false
  }
}
