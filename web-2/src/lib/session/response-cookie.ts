import type { NextResponse } from "next/server"

import {
  expiredCookieOptions,
  SESSION_COOKIES,
  sessionCookieOptions,
} from "./cookie"
import type { CookieUpdate } from "./fresh"
import type { Realm } from "./types"

/** Writes a refreshed session to, or deletes it from, a proxy/BFF response. */
export function applyCookieUpdate(
  response: NextResponse,
  realm: Realm,
  update: CookieUpdate
): NextResponse {
  const name = SESSION_COOKIES[realm]
  if (update.action === "set") {
    response.cookies.set(
      name,
      update.value,
      sessionCookieOptions(update.session)
    )
  } else if (update.action === "clear") {
    response.cookies.set(name, "", expiredCookieOptions)
  }
  return response
}
