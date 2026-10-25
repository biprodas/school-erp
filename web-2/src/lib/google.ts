import "server-only"

import { backendUrl, callBackend, readJson } from "~/lib/api/backend"

/** How long the answer is kept; Google is turned on or off by deployment. */
const TTL_MS = 5 * 60_000
/** After a failed check, ask again sooner. */
const RETRY_MS = 30_000

let cached: { enabled: boolean; until: number } | undefined

/**
 * Whether "Continue with Google" works (`GOOGLE_CLIENT_ID` set on the
 * backend). There is no flag endpoint, so this asks `GET
 * /oauth/google/start` without a return host: 404 `GOOGLE_SIGNIN_DISABLED`
 * when it is off, 400 `INVALID_RETURN_HOST` when it is on. Nothing is
 * started either way. Cached per server process.
 */
export async function isGoogleSignInEnabled(now = Date.now()) {
  if (cached && cached.until > now) return cached.enabled

  let enabled = false
  let ttl = RETRY_MS
  try {
    const response = await callBackend(backendUrl("/oauth/google/start"), {
      method: "GET",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(3_000),
    })
    const body = (await readJson(response)) as { code?: unknown } | null
    if (body?.code === "INVALID_RETURN_HOST") {
      enabled = true
      ttl = TTL_MS
    } else if (body?.code === "GOOGLE_SIGNIN_DISABLED") {
      ttl = TTL_MS
    }
  } catch {
    // Backend unreachable: hide the button for now.
  }
  cached = { enabled, until: now + ttl }
  return enabled
}

/** For tests. */
export function clearGoogleCache() {
  cached = undefined
}
