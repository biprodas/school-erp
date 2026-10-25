import { NextResponse, type NextRequest } from "next/server"

import { startSession } from "~/features/auth/session"
import { backendFetch } from "~/lib/api/server"
import { getRequestHost } from "~/lib/request-host"
import { destinationAfterSignIn } from "~/lib/session/home"
import type { TokenResponse } from "~/lib/session/tokens"

/**
 * `/auth/handoff?code=&next=` on a school host: the end of a move from
 * another host (Google sign-in, signup, the school switcher, the portal).
 * Redeems the one-time code (`POST /auth/handoff`), signs in here and goes
 * to `next` (same host) or the user's home. A used, expired or foreign code
 * ends on `/login?error=handoff`.
 */
export async function GET(request: NextRequest) {
  const { origin } = await getRequestHost()
  const params = request.nextUrl.searchParams
  const code = params.get("code")

  let destination = "/login?error=handoff"
  if (code) {
    try {
      const tokens = await backendFetch<TokenResponse>("/auth/handoff", {
        method: "POST",
        body: { code },
        session: null,
      })
      const session = await startSession(tokens)
      destination = destinationAfterSignIn(session, params.get("next"))
    } catch (error) {
      console.warn("[handoff] code refused", error)
    }
  }

  const response = NextResponse.redirect(new URL(destination, origin), 303)
  // The code is in this URL; keep it out of the next page's Referer.
  response.headers.set("referrer-policy", "no-referrer")
  return response
}
