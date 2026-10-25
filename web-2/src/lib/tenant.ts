import { apiConfig } from "~/config/api-config"

import { unwrap } from "./api/envelope"
import type { HostInfo } from "./hosts"

/** What a school host resolves to. */
export type TenantLookup =
  | { status: "found"; slug: string; name: string }
  /** An old slug (renamed within 12 months); redirect to `slug`. */
  | { status: "moved"; slug: string }
  | { status: "not-found" }

/** The backend couldn't answer; not cached, so the next request retries. */
export class TenantLookupError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "TenantLookupError"
  }
}

const { cacheTtlMs: TTL_MS, timeoutMs: TIMEOUT_MS } = apiConfig.tenantLookup

const cache = new Map<string, { value: TenantLookup; expiresAt: number }>()
const inFlight = new Map<string, Promise<TenantLookup>>()

/**
 * Resolves a school or custom-domain host through the backend's public
 * endpoints (`by-slug`, `resolve`). Answers, including "not found", are
 * cached in memory for 60 s per server process, and concurrent lookups of
 * one host share a request, so the proxy adds no backend call to most
 * page loads. The backend still resolves the tenant itself on every API
 * call, so a stale answer here can't leak data.
 */
export function lookupTenant(
  host: Extract<HostInfo, { kind: "school" | "custom" }>,
  options: { apiUrl: string; fetch?: typeof fetch }
): Promise<TenantLookup> {
  const key =
    host.kind === "school" ? `slug:${host.slug}` : `host:${host.hostname}`
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now())
    return Promise.resolve(cached.value)

  let pending = inFlight.get(key)
  if (!pending) {
    pending = fetchTenant(host, options)
      .then((value) => {
        cache.set(key, { value, expiresAt: Date.now() + TTL_MS })
        return value
      })
      .finally(() => inFlight.delete(key))
    inFlight.set(key, pending)
  }
  return pending
}

/** For tests. */
export function clearTenantCache() {
  cache.clear()
  inFlight.clear()
}

async function fetchTenant(
  host: Extract<HostInfo, { kind: "school" | "custom" }>,
  { apiUrl, fetch: fetcher = fetch }: { apiUrl: string; fetch?: typeof fetch }
): Promise<TenantLookup> {
  const url = new URL(
    host.kind === "school"
      ? "/api/public/organizations/by-slug"
      : "/api/public/organizations/resolve",
    apiUrl
  )
  url.searchParams.set(
    host.kind === "school" ? "slug" : "host",
    host.kind === "school" ? host.slug : host.hostname
  )

  let response: Response
  try {
    response = await fetcher(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (cause) {
    throw new TenantLookupError(`Tenant lookup failed for ${host.hostname}`, {
      cause,
    })
  }

  if (response.status === 404) return { status: "not-found" }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new TenantLookupError(
      `Tenant lookup for ${host.hostname} answered ${response.status}`
    )
  }

  const data = unwrap<{ slug: string; name: string; movedFrom?: string }>(
    response.status,
    body
  )
  return data.movedFrom
    ? { status: "moved", slug: data.slug }
    : { status: "found", slug: data.slug, name: data.name }
}
