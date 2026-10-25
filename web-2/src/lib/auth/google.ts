import "server-only"

import { NextResponse } from "next/server"

import { authConfig } from "~/config/auth-config"
import { backendUrl, callBackend, readJson } from "~/lib/api/backend"
import { clientInfo, setClientHeaders } from "~/lib/security/client-ip"
import { getRequestHost } from "~/lib/tenancy/request-host"

// How long the answer is kept (Google is turned on or off by deployment),
// and how soon to ask again after a failed check.
const { ttlMs: TTL_MS, retryMs: RETRY_MS } = authConfig.googleProbe

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
  let ttl: number = RETRY_MS
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

/**
 * A route handler's answer that starts Google sign-in from this host: the
 * backend's `GET /oauth/google/start` with this host as the return host
 * (so the browser can't choose another), followed to Google. On failure,
 * back to `errorPage` with `?error=google_disabled|google_failed`.
 */
export async function startGoogle(
  request: Request,
  {
    intent,
    next,
    errorPage,
  }: { intent: "signin" | "signup"; next: string; errorPage: string }
): Promise<Response> {
  const { origin } = await getRequestHost()
  const url = backendUrl("/oauth/google/start")
  url.searchParams.set("return", new URL(origin).hostname)
  url.searchParams.set("intent", intent)
  if (next) url.searchParams.set("next", next)

  const headers = new Headers({ accept: "application/json" })
  setClientHeaders(headers, clientInfo(request.headers))

  let error = "google_failed"
  try {
    const response = await callBackend(url, { method: "GET", headers })
    const location = response.headers.get("location")
    if (response.status >= 300 && response.status < 400 && location) {
      return NextResponse.redirect(location, 303)
    }
    if (response.status === 404) error = "google_disabled"
  } catch (cause) {
    console.warn("[google] start failed", cause)
  }
  return NextResponse.redirect(
    new URL(`${errorPage}?error=${error}`, origin),
    303
  )
}
