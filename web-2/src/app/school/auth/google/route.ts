import type { NextRequest } from "next/server"

import { startGoogle } from "~/lib/google"
import { safeNext } from "~/lib/safe-next"

/**
 * "Continue with Google" on a school host. Google comes back through the
 * backend to `/auth/handoff` here, or to `/login` with an error.
 */
export function GET(request: NextRequest) {
  return startGoogle(request, {
    intent: "signin",
    next: safeNext(request.nextUrl.searchParams.get("next"), ""),
    errorPage: "/login",
  })
}
