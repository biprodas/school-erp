/** Paths (and everything under them) that are never a redirect target. */
const BLOCKED_PATHS = ["/auth/handoff", "/api"]

const BASE = "http://same-host.invalid"

/**
 * A `next` / return-to value that is safe to redirect to: a path on this
 * host only. Anything else (absolute or protocol-relative URLs, backslash
 * tricks, control characters, the handoff and API routes) gives `fallback`.
 */
export function safeNext(
  next: string | null | undefined,
  fallback = "/"
): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 2048) {
    return fallback
  }
  // Browsers treat `\` like `/`, so `/\evil.com` is protocol-relative.
  if (
    !next.startsWith("/") ||
    next.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(next)
  ) {
    return fallback
  }

  let url: URL
  try {
    url = new URL(next, BASE)
  } catch {
    return fallback
  }
  if (url.origin !== BASE) return fallback

  const blocked = BLOCKED_PATHS.some(
    (path) => url.pathname === path || url.pathname.startsWith(`${path}/`)
  )
  return blocked ? fallback : `${url.pathname}${url.search}${url.hash}`
}
