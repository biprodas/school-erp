import { classifyHost } from "./hosts"
import type { Realm } from "./session/types"
import { lookupTenant } from "./tenant"
import { apiConfig } from "~/config/api-config"
import { appConfig } from "~/config/app-config"

/** What a request's host is, with the school looked up where needed. */
export type ResolvedHost =
  | { kind: "site"; hostname: string }
  | { kind: "admin"; hostname: string }
  | { kind: "school"; hostname: string; slug: string }
  /** An old slug of a school; redirect to `slug`. */
  | { kind: "moved"; hostname: string; slug: string }
  | { kind: "unknown"; hostname: string }

/**
 * Classifies the Host header and, for school and custom-domain hosts, asks
 * the backend which school it is (cached, see `lookupTenant`). Throws
 * `TenantLookupError` when the backend can't answer. Used by `src/proxy.ts`
 * for pages and by the BFF for `/api/*`, which the proxy doesn't see.
 */
export async function resolveHost(host: string): Promise<ResolvedHost> {
  const info = classifyHost(host, appConfig)
  if (info.kind !== "school" && info.kind !== "custom") return info

  const tenant = await lookupTenant(info, { apiUrl: apiConfig.apiUrl })
  switch (tenant.status) {
    case "found":
      return { kind: "school", hostname: info.hostname, slug: tenant.slug }
    case "moved":
      return { kind: "moved", hostname: info.hostname, slug: tenant.slug }
    case "not-found":
      return { kind: "unknown", hostname: info.hostname }
  }
}

/** The session realm of a host, or null where nobody signs in. */
export function realmOf(host: ResolvedHost): Realm | null {
  if (host.kind === "school") return "tenant"
  if (host.kind === "admin") return "platform"
  return null
}
