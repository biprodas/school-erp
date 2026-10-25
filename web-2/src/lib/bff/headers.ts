import { clientInfo, setClientHeaders } from "~/lib/security/client-ip"
import type { ResolvedHost } from "~/lib/tenancy/resolve-host"
import type { Session } from "~/lib/auth/types"

/** Browser headers the backend may see; cookies and auth never pass. */
const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "content-type",
  "if-none-match",
  "if-modified-since",
  "range",
  "idempotency-key",
]

/** Backend headers the browser may see (no `set-cookie`, no hop-by-hop). */
const PASSED_RESPONSE_HEADERS = [
  "content-type",
  "content-length",
  "content-disposition",
  "content-range",
  "accept-ranges",
  "cache-control",
  "etag",
  "last-modified",
  "location",
  "retry-after",
  "x-request-id",
  "idempotent-replayed",
]

/**
 * Headers for a call to the backend on behalf of a browser request: the
 * session's bearer token, the school (`x-tenant-id`), the client's address
 * and browser (`x-forwarded-for` with one trustworthy entry, see
 * `lib/security/client-ip.ts`; the backend trusts this server as a proxy) and a
 * request id for the logs.
 */
export function backendHeaders(
  incoming: Headers,
  host: ResolvedHost,
  session: Session | null
): Headers {
  const headers = new Headers()
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = incoming.get(name)
    if (value) headers.set(name, value)
  }
  if (session) headers.set("authorization", `Bearer ${session.at}`)
  if (host.kind === "school") headers.set("x-tenant-id", host.slug)

  setClientHeaders(headers, clientInfo(incoming))
  headers.set("x-forwarded-host", incoming.get("host") ?? host.hostname)
  const proto = incoming.get("x-forwarded-proto")
  if (proto) headers.set("x-forwarded-proto", proto)
  headers.set(
    "x-request-id",
    incoming.get("x-request-id") ?? crypto.randomUUID()
  )
  return headers
}

/** The backend response headers to hand to the browser. */
export function passedHeaders(backend: Headers): Headers {
  const headers = new Headers()
  for (const name of PASSED_RESPONSE_HEADERS) {
    const value = backend.get(name)
    if (value) headers.set(name, value)
  }
  backend.forEach((value, name) => {
    if (name.startsWith("x-ratelimit-")) headers.set(name, value)
  })
  return headers
}
