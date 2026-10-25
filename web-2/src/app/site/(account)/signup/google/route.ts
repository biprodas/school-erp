import type { NextRequest } from "next/server"

import { startGoogle } from "~/lib/google"

/**
 * "Sign up with Google" on the apex. Google verifies the email and the
 * browser comes back to `/signup?google_ticket=…`, where the form
 * continues without a password.
 */
export function GET(request: NextRequest) {
  return startGoogle(request, {
    intent: "signup",
    next: "/signup",
    errorPage: "/signup",
  })
}
