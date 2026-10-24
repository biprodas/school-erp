import "server-only"

import { cookies } from "next/headers"

import { serverEnv } from "~/lib/env"
import { getRequestHost } from "~/lib/request-host"

import {
  expiredCookieOptions,
  SESSION_COOKIES,
  sessionCookieOptions,
} from "./cookie"
import { readSession, type SessionScope } from "./fresh"
import { seal } from "./seal"
import type { Session } from "./types"

export type { Realm, Session, SessionUser } from "./types"

/** The session scope of the current page's host, or null (marketing site). */
export async function currentScope(): Promise<SessionScope | null> {
  const { kind, slug } = await getRequestHost()
  if (kind === "school") return { realm: "tenant", slug }
  if (kind === "admin") return { realm: "platform", slug: null }
  return null
}

/**
 * The signed-in session for this host, in server components, server
 * actions and route handlers behind the proxy. `src/proxy.ts` has already
 * refreshed it when it was about to expire.
 */
export async function getSession(): Promise<Session | null> {
  const scope = await currentScope()
  if (!scope) return null
  const value = (await cookies()).get(SESSION_COOKIES[scope.realm])?.value
  return readSession(value, scope)
}

/** Stores a session (server actions and route handlers only). */
export async function setSession(session: Session): Promise<void> {
  const value = await seal(session, serverEnv().SESSION_SECRET)
  ;(await cookies()).set(
    SESSION_COOKIES[session.realm],
    value,
    sessionCookieOptions(session)
  )
}

/** Merges `patch` into the current session, e.g. after onboarding. */
export async function updateSession(
  patch: Partial<Omit<Session, "v" | "realm">>
): Promise<Session | null> {
  const session = await getSession()
  if (!session) return null
  const next = { ...session, ...patch }
  await setSession(next)
  return next
}

/** Deletes this host's session cookie (server actions and route handlers). */
export async function clearSession(): Promise<void> {
  const scope = await currentScope()
  if (!scope) return
  ;(await cookies()).set(SESSION_COOKIES[scope.realm], "", expiredCookieOptions)
}
