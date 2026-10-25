import "server-only"

import { backendFetch } from "~/lib/api/server"
import { setSession, type Session } from "~/lib/session"
import { fromTokenResponse, type TokenResponse } from "~/lib/session/tokens"

interface Me {
  organization?: { onboardingCompletedAt?: string | null } | null
}

/**
 * Whether the school finished onboarding, from `GET /auth/me` (the token
 * response doesn't say). Null when it can't be read: the user then waits
 * on `/setting-up`, which checks again.
 */
export async function onboardingCompletedAt(
  session: Session
): Promise<string | null> {
  try {
    const me = await backendFetch<Me>("/auth/me", { session })
    return me.organization?.onboardingCompletedAt ?? null
  } catch (error) {
    console.warn("[auth] couldn't read /auth/me after sign-in", error)
    return null
  }
}

/**
 * Stores the session from a sign-in answer (login, activate, handoff) in
 * this host's cookie, in a server action or route handler.
 */
export async function startSession(tokens: TokenResponse): Promise<Session> {
  const session = fromTokenResponse(tokens, "tenant")
  session.onboardingCompletedAt = await onboardingCompletedAt(session)
  await setSession(session)
  return session
}
