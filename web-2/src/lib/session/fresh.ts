import type { ClientInfo } from "~/lib/client-ip"
import { serverEnv } from "~/lib/env"

import {
  needsRefresh,
  refreshSession,
  RefreshUnavailableError,
} from "./refresh"
import { seal, unseal } from "./seal"
import type { Realm, Session } from "./types"

/** Which session a host accepts. */
export interface SessionScope {
  realm: Realm
  /** The host's school; a cookie for another school counts as none. */
  slug: string | null
}

/**
 * What to do with the cookie after reading it: leave it, replace it with a
 * new sealed value (after a refresh), or delete it (expired, revoked,
 * unreadable, or for another school).
 */
export type CookieUpdate =
  | { action: "keep" }
  | { action: "set"; value: string; session: Session }
  | { action: "clear" }

export interface FreshSession {
  session: Session | null
  cookie: CookieUpdate
}

/** The session in `value` if it belongs to `scope`, else null. */
export async function readSession(
  value: string | null | undefined,
  scope: SessionScope
): Promise<Session | null> {
  if (!value) return null
  const session = await unseal(value, serverEnv().SESSION_SECRET)
  if (!session || session.realm !== scope.realm) return null
  if (scope.realm === "tenant" && session.slug !== scope.slug) return null
  return session
}

/**
 * The session from a cookie, refreshed first when its access token is
 * about to expire (or `force`, after the backend answered 401). When the
 * backend is unreachable the old session is kept, so a short outage
 * doesn't sign anyone out.
 */
export async function ensureFreshSession(
  value: string | null | undefined,
  scope: SessionScope,
  context: { client?: ClientInfo; force?: boolean } = {}
): Promise<FreshSession> {
  if (!value) return { session: null, cookie: { action: "keep" } }

  const session = await readSession(value, scope)
  if (!session) return { session: null, cookie: { action: "clear" } }
  if (!context.force && !needsRefresh(session)) {
    return { session, cookie: { action: "keep" } }
  }

  let next: Session | null
  try {
    next = await refreshSession(session, context)
  } catch (error) {
    if (error instanceof RefreshUnavailableError) {
      return { session, cookie: { action: "keep" } }
    }
    throw error
  }
  if (!next) return { session: null, cookie: { action: "clear" } }

  const sealed = await seal(next, serverEnv().SESSION_SECRET)
  return {
    session: next,
    cookie: { action: "set", value: sealed, session: next },
  }
}

/**
 * `cookie` request header with one cookie replaced (or removed with
 * null), so code after the proxy sees the refreshed session.
 */
export function replaceCookie(
  header: string | null,
  name: string,
  value: string | null
): string {
  const others = (header ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith(`${name}=`))
  if (value !== null) others.push(`${name}=${value}`)
  return others.join("; ")
}
