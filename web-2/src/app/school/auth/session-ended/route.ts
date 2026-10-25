import { NextResponse, type NextRequest } from "next/server"

import { getRequestHost } from "~/lib/tenancy/request-host"
import { safeNext } from "~/lib/security/safe-next"
import { clearSession } from "~/lib/auth"

/**
 * `/auth/session-ended?next=`: where a layout sends the user when the
 * backend says their session is over (signed out everywhere, revoked by
 * an admin) although the cookie looks fine to the proxy. Layouts can't
 * delete cookies; this deletes it, so `/login` doesn't bounce straight
 * back to the home page, and asks to sign in again.
 */
export async function GET(request: NextRequest) {
  const { origin } = await getRequestHost()
  await clearSession()
  const next = safeNext(request.nextUrl.searchParams.get("next"), "")
  const target = new URL("/login", origin)
  target.searchParams.set("error", "session_ended")
  if (next) target.searchParams.set("next", next)
  return NextResponse.redirect(target, 303)
}
