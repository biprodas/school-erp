import { NextResponse, type NextRequest } from "next/server"

import { backendUrl, callBackend } from "~/lib/api/backend"
import { clientInfo, setClientHeaders } from "~/lib/client-ip"
import { getRequestHost } from "~/lib/request-host"
import { safeNext } from "~/lib/safe-next"

/**
 * "Continue with Google" on a school host. Asks the backend to start
 * (`GET /oauth/google/start`) with this host as the return host, so the
 * browser can't pick another, and follows its redirect to Google. Google
 * comes back through the backend to `/auth/handoff` here, or to `/login`
 * with an error.
 */
export async function GET(request: NextRequest) {
  const { origin } = await getRequestHost()
  const next = safeNext(request.nextUrl.searchParams.get("next"), "")

  const url = backendUrl("/oauth/google/start")
  url.searchParams.set("return", new URL(origin).hostname)
  url.searchParams.set("intent", "signin")
  if (next) url.searchParams.set("next", next)

  const headers = new Headers({ accept: "application/json" })
  setClientHeaders(headers, clientInfo(request.headers))

  let target = "/login?error=google_failed"
  try {
    const response = await callBackend(url, { method: "GET", headers })
    const location = response.headers.get("location")
    if (response.status >= 300 && response.status < 400 && location) {
      return NextResponse.redirect(location, 303)
    }
    if (response.status === 404) target = "/login?error=google_disabled"
  } catch (error) {
    console.warn("[google] start failed", error)
  }
  return NextResponse.redirect(new URL(target, origin), 303)
}
