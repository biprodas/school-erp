import "server-only"

import { headers } from "next/headers"

import { clientInfo, setClientHeaders } from "~/lib/security/client-ip"
import { getRequestHost } from "~/lib/tenancy/request-host"
import { getSession, type Session } from "~/lib/auth"

import { backendUrl, callBackend, readJson } from "./backend"
import { toSearch, type ApiRequest } from "./client"
import { unwrap, unwrapPage, type Page } from "./envelope"

export interface BackendRequest extends ApiRequest {
  /** Defaults to this host's session; pass null to call without one. */
  session?: Session | null
}

/**
 * Calls the backend from server components and server actions, as the
 * signed-in user of this host, and returns the envelope's `data`. Never
 * refreshes: `src/proxy.ts` already did before the page rendered. A 401
 * here means the session is gone; callers send the user to sign in.
 */
export async function backendFetch<T>(
  path: string,
  init: BackendRequest = {}
): Promise<T> {
  const response = await send(path, init)
  return unwrap<T>(response.status, await readJson(response))
}

/** Like `backendFetch`, for paginated lists: `{ items, meta }`. */
export async function backendFetchPage<T>(
  path: string,
  init: BackendRequest = {}
): Promise<Page<T>> {
  const response = await send(path, init)
  return unwrapPage<T>(response.status, await readJson(response))
}

async function send(
  path: string,
  { session, body, query, headers: extra, ...init }: BackendRequest
): Promise<Response> {
  const host = await getRequestHost()
  const incoming = await headers()
  const auth = session === undefined ? await getSession() : session

  const requestHeaders = new Headers(extra)
  requestHeaders.set("accept", "application/json")
  if (auth) requestHeaders.set("authorization", `Bearer ${auth.at}`)
  if (host.kind === "school" && host.slug) {
    requestHeaders.set("x-tenant-id", host.slug)
  }
  setClientHeaders(requestHeaders, clientInfo(incoming))
  const language = incoming.get("accept-language")
  if (language) requestHeaders.set("accept-language", language)

  let payload: BodyInit | undefined
  if (body !== undefined) {
    payload = body instanceof FormData ? body : JSON.stringify(body)
    if (!(body instanceof FormData)) {
      requestHeaders.set("content-type", "application/json")
    }
  }

  return callBackend(backendUrl(path, toSearch(query)), {
    ...init,
    headers: requestHeaders,
    body: payload,
  })
}
