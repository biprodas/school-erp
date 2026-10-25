import type { NextRequest } from "next/server"

import { startGoogle } from "~/lib/auth/google"
import { safeNext } from "~/lib/security/safe-next"

/**
 * "Continue with Google" on the admin host. Google comes back through the
 * backend to `/auth/handoff` here, or to `/login` with an error.
 */
export function GET(request: NextRequest) {
  return startGoogle(request, {
    intent: "signin",
    next: safeNext(request.nextUrl.searchParams.get("next"), ""),
    errorPage: "/login",
  })
}
