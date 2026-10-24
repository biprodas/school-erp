import { createHash } from "node:crypto"

import { backendUrl, callBackend, readJson } from "~/lib/api/backend"
import { unwrap } from "~/lib/api/envelope"
import { setClientHeaders, type ClientInfo } from "~/lib/client-ip"

import { fromTokenResponse, type TokenResponse } from "./tokens"
import type { Realm, Session } from "./types"

/** Refresh this long before the access token expires. */
export const REFRESH_MARGIN_SECONDS = 60

/**
 * How long a rotated refresh token still maps to its replacement. A tab
 * can send a request with the old cookie just after another request
 * rotated it; sending the old token to the backend again would look like
 * token theft and end the whole sign-in (`REFRESH_TOKEN_REUSED`).
 */
const GRACE_MS = 30_000

const REFRESH_PATHS: Record<Realm, string> = {
  tenant: "/auth/refresh",
  platform: "/platform/auth/refresh",
}

/** The backend couldn't be asked (down, 5xx); keep the session as it is. */
export class RefreshUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "RefreshUnavailableError"
  }
}

export const needsRefresh = (session: Session, now = Date.now()) =>
  session.atExp - Math.floor(now / 1000) < REFRESH_MARGIN_SECONDS

const inFlight = new Map<string, Promise<Session | null>>()
const rotated = new Map<string, { session: Session; until: number }>()

const tokenKey = (refreshToken: string) =>
  createHash("sha256").update(refreshToken).digest("hex")

/**
 * New tokens for `session`, or null when the backend refuses the refresh
 * token (expired, revoked or reused: the user signs in again). Concurrent
 * calls for one session share one backend request, and a refresh token
 * rotated in the last 30 s answers with its replacement. Both hold per
 * server process; several frontend instances need a shared lock or
 * sticky sessions (doc/frontend-implementation-plan.md 4.3).
 */
export function refreshSession(
  session: Session,
  context: { client?: ClientInfo } = {}
): Promise<Session | null> {
  const key = tokenKey(session.rt)
  const recent = rotated.get(key)
  if (recent && recent.until > Date.now())
    return Promise.resolve(recent.session)

  let pending = inFlight.get(key)
  if (!pending) {
    pending = requestRefresh(session, context)
      .then((next) => {
        if (next) remember(key, next)
        return next
      })
      .finally(() => inFlight.delete(key))
    inFlight.set(key, pending)
  }
  return pending
}

function remember(key: string, session: Session) {
  const now = Date.now()
  if (rotated.size > 1000) {
    for (const [k, v] of rotated) if (v.until <= now) rotated.delete(k)
  }
  rotated.set(key, { session, until: now + GRACE_MS })
}

/** For tests. */
export function clearRefreshState() {
  inFlight.clear()
  rotated.clear()
}

async function requestRefresh(
  session: Session,
  { client }: { client?: ClientInfo }
): Promise<Session | null> {
  const headers = new Headers({
    accept: "application/json",
    "content-type": "application/json",
  })
  if (session.realm === "tenant" && session.slug) {
    headers.set("x-tenant-id", session.slug)
  }
  setClientHeaders(headers, client)

  let response: Response
  try {
    response = await callBackend(backendUrl(REFRESH_PATHS[session.realm]), {
      method: "POST",
      headers,
      body: JSON.stringify({ refreshToken: session.rt }),
    })
  } catch (cause) {
    throw new RefreshUnavailableError("Refresh request failed", { cause })
  }

  const body = await readJson(response)
  if (response.status >= 400 && response.status < 500) return null
  if (!response.ok) {
    throw new RefreshUnavailableError(`Refresh answered ${response.status}`)
  }
  const tokens = unwrap<TokenResponse>(response.status, body)
  const next = fromTokenResponse(tokens, session.realm, session)
  // The platform response has no organization; keep the session's binding.
  return session.realm === "tenant" && !tokens.organization
    ? { ...next, orgId: session.orgId, slug: session.slug }
    : next
}
