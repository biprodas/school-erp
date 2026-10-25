import "server-only"

import { backendFetch } from "~/lib/api/server"
import { setSession, type Session } from "~/lib/session"
import { fromTokenResponse, type TokenResponse } from "~/lib/session/tokens"

/** `code` of the refusal for an account that isn't a platform admin. */
export const PLATFORM_ADMIN_REQUIRED = "PLATFORM_ADMIN_REQUIRED"

/**
 * Stores a platform sign-in (password or Google handoff) in the admin
 * host's cookie. The backend signs any account in to the platform realm,
 * but the console is for platform admins only: anyone else's new backend
 * session is ended again and null comes back.
 */
export async function startPlatformSession(
  tokens: TokenResponse
): Promise<Session | null> {
  const session = fromTokenResponse(tokens, "platform")
  if (!session.user.isAdmin) {
    await backendFetch("/platform/auth/logout", {
      method: "POST",
      body: {},
      session,
    }).catch((error: unknown) =>
      console.warn("[admin] couldn't end a non-admin session", error)
    )
    return null
  }
  await setSession(session)
  return session
}
