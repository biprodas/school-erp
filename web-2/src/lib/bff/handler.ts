import { NextResponse, type NextRequest } from "next/server"

import { backendUrl, callBackend, readJson } from "~/lib/api/backend"
import { SESSION_EXPIRED } from "~/lib/api/errors"
import { clientInfo } from "~/lib/client-ip"
import { realmOf, resolveHost, type ResolvedHost } from "~/lib/resolve-host"
import { SESSION_COOKIES } from "~/lib/session/cookie"
import {
  ensureFreshSession,
  type FreshSession,
  type SessionScope,
} from "~/lib/session/fresh"
import { applyCookieUpdate } from "~/lib/session/response-cookie"
import type { Session } from "~/lib/session/types"

import { backendHeaders, passedHeaders } from "./headers"
import { isForwardable, passesCsrfCheck } from "./rules"

/** Bodies up to this size are buffered, so a 401 can be retried after a refresh. */
const MAX_BUFFERED_BODY = 1_000_000

/** 401 codes that mean "this access token no longer works". */
const TOKEN_REJECTED = "UNAUTHORIZED"
const SESSION_REVOKED = "SESSION_REVOKED"

/**
 * The same-origin API for the browser (doc/frontend-implementation-plan.md
 * 4.3): `/api/<path>` on any host is forwarded to the backend's
 * `/api/<path>` with this host's session as a bearer token and its school
 * as `x-tenant-id`. Browser JavaScript never holds a token.
 *
 * Access tokens are refreshed shortly before they expire, and once more
 * when the backend still answers 401; when the refresh token is refused
 * too, the cookie is deleted and the answer is 401 `SESSION_EXPIRED`.
 */
export async function handleBff(request: NextRequest): Promise<Response> {
  const hostHeader = request.headers.get("host") ?? ""
  let host: ResolvedHost
  try {
    host = await resolveHost(hostHeader)
  } catch {
    return problem(
      503,
      "SERVICE_UNAVAILABLE",
      "The school can't be reached right now"
    )
  }

  const path = request.nextUrl.pathname.replace(/^\/api\/?/, "")
  if (!isForwardable(host, path)) return problem(404, "NOT_FOUND", "Not found")
  if (!passesCsrfCheck(request.method, request.headers, hostHeader)) {
    return problem(403, "CSRF_REJECTED", "Request refused")
  }

  const realm = realmOf(host)
  const scope: SessionScope | null = realm && {
    realm,
    slug: host.kind === "school" ? host.slug : null,
  }
  const cookieValue = realm
    ? request.cookies.get(SESSION_COOKIES[realm])?.value
    : undefined
  const client = clientInfo(request.headers)

  let fresh: FreshSession = scope
    ? await ensureFreshSession(cookieValue, scope, { client })
    : { session: null, cookie: { action: "keep" } }

  const body = await readBody(request)
  const url = backendUrl(path, request.nextUrl.search.replace(/^\?/, ""))
  const send = (session: Session | null) =>
    callBackend(url, {
      method: request.method,
      headers: backendHeaders(request.headers, host, session),
      body: body.value,
      ...(body.streamed && { duplex: "half" as const }),
      signal: request.signal,
    })

  let response: Response
  try {
    response = await send(fresh.session)

    if (fresh.session && scope) {
      let code = await authFailureCode(response)
      // A token the backend rejects before we expected it to (clock skew,
      // a role change): refresh once more and retry, if the body allows.
      if (
        code === TOKEN_REJECTED &&
        fresh.cookie.action !== "set" &&
        body.replayable
      ) {
        fresh = await ensureFreshSession(cookieValue, scope, {
          client,
          force: true,
        })
        if (fresh.session) {
          response = await send(fresh.session)
          code = await authFailureCode(response)
        }
      }
      if (
        !fresh.session ||
        code === TOKEN_REJECTED ||
        code === SESSION_REVOKED
      ) {
        const expired = problem(
          401,
          SESSION_EXPIRED,
          "Your session has ended. Please sign in again."
        )
        return applyCookieUpdate(expired, scope.realm, { action: "clear" })
      }
    }
  } catch {
    const failed = problem(
      502,
      "BAD_GATEWAY",
      "The server can't be reached right now"
    )
    return realm ? applyCookieUpdate(failed, realm, fresh.cookie) : failed
  }

  const out = new NextResponse(response.body, {
    status: response.status,
    headers: passedHeaders(response.headers),
  })
  return realm ? applyCookieUpdate(out, realm, fresh.cookie) : out
}

/** The backend's error code when it answered 401, else null. */
async function authFailureCode(response: Response): Promise<string | null> {
  if (response.status !== 401) return null
  const body = (await readJson(response.clone())) as { code?: unknown } | null
  return typeof body?.code === "string" ? body.code : null
}

/**
 * The request body: buffered when small (so it can be sent again after a
 * refresh), streamed otherwise (uploads), and nothing for GET/HEAD.
 */
async function readBody(request: NextRequest): Promise<{
  value: BodyInit | null
  replayable: boolean
  streamed: boolean
}> {
  if (request.method === "GET" || request.method === "HEAD" || !request.body) {
    return { value: null, replayable: true, streamed: false }
  }
  const type = request.headers.get("content-type") ?? ""
  // No Content-Length (a chunked upload) counts as too large to buffer.
  const declared = request.headers.get("content-length")
  const length = declared === null ? Number.NaN : Number(declared)
  if (
    !type.startsWith("multipart/") &&
    Number.isFinite(length) &&
    length <= MAX_BUFFERED_BODY
  ) {
    return {
      value: await request.arrayBuffer(),
      replayable: true,
      streamed: false,
    }
  }
  return { value: request.body, replayable: false, streamed: true }
}

/** An error in the backend's envelope shape, so `apiFetch` reads it alike. */
function problem(statusCode: number, code: string, message: string) {
  return NextResponse.json(
    { success: false, statusCode, message, code },
    { status: statusCode, headers: { "cache-control": "no-store" } }
  )
}
