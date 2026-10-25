import { NextResponse, type NextRequest } from "next/server"

import { startPlatformSession } from "~/features/admin/session"
import { backendFetch } from "~/lib/api/server"
import { getRequestHost } from "~/lib/tenancy/request-host"
import { adminDestination } from "~/lib/auth/home"
import type { TokenResponse } from "~/lib/auth/tokens"

/**
 * `/auth/handoff?code=&next=` on the admin host: the end of Google
 * sign-in. Redeems the platform code (`POST /platform/auth/handoff/
 * exchange`) and signs in here; a refused code ends on
 * `/login?error=handoff`, an account that isn't a platform admin on
 * `/login?error=not_admin`.
 */
export async function GET(request: NextRequest) {
  const { origin } = await getRequestHost()
  const params = request.nextUrl.searchParams
  const code = params.get("code")

  let destination = "/login?error=handoff"
  if (code) {
    try {
      const tokens = await backendFetch<TokenResponse>(
        "/platform/auth/handoff/exchange",
        { method: "POST", body: { code }, session: null }
      )
      destination = (await startPlatformSession(tokens))
        ? adminDestination(params.get("next"))
        : "/login?error=not_admin"
    } catch (error) {
      console.warn("[admin handoff] code refused", error)
    }
  }

  const response = NextResponse.redirect(new URL(destination, origin), 303)
  // The code is in this URL; keep it out of the next page's Referer.
  response.headers.set("referrer-policy", "no-referrer")
  return response
}
