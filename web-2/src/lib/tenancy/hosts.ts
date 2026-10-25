import { isReservedSlug, isValidSlug } from "./slugs"

/**
 * What a request's host serves (doc/domains-and-routing.md, section 1):
 * - `site`: the apex (marketing, signup, "Find your school"), also
 *   `www.` and `localhost`;
 * - `admin`: the platform admin app;
 * - `school`: `<slug>.<root domain>`;
 * - `custom`: any other host, looked up as a school's custom domain;
 * - `unknown`: a host we never serve (a reserved or malformed slug, or a
 *   deeper subdomain of the root domain).
 */
export type HostInfo =
  | { kind: "site"; hostname: string }
  | { kind: "admin"; hostname: string }
  | { kind: "school"; hostname: string; slug: string }
  | { kind: "custom"; hostname: string }
  | { kind: "unknown"; hostname: string }

export type HostKind = HostInfo["kind"]

export interface HostConfig {
  rootDomain: string
  adminHost: string
}

/** `Acme.LVH.me:3000` → `acme.lvh.me`; also drops a trailing dot. */
export function normalizeHostname(host: string): string {
  const trimmed = host.trim().toLowerCase()
  // `[::1]:3000` (IPv6) keeps its brackets; anything else loses `:port`.
  const withoutPort = trimmed.startsWith("[")
    ? trimmed.slice(0, trimmed.indexOf("]") + 1)
    : trimmed.split(":")[0]
  return withoutPort.replace(/\.$/, "")
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])

export function classifyHost(host: string, config: HostConfig): HostInfo {
  const hostname = normalizeHostname(host)
  const root = config.rootDomain.toLowerCase()

  if (
    hostname === root ||
    hostname === `www.${root}` ||
    LOCAL_HOSTS.has(hostname)
  ) {
    return { kind: "site", hostname }
  }
  if (hostname === config.adminHost.toLowerCase()) {
    return { kind: "admin", hostname }
  }
  if (hostname.endsWith(`.${root}`)) {
    const label = hostname.slice(0, -(root.length + 1))
    if (label.includes(".") || isReservedSlug(label) || !isValidSlug(label)) {
      return { kind: "unknown", hostname }
    }
    return { kind: "school", hostname, slug: label }
  }
  if (!hostname || !hostname.includes(".")) {
    return { kind: "unknown", hostname }
  }
  return { kind: "custom", hostname }
}

/**
 * An absolute URL on `hostname` with the protocol and port of `origin`
 * (the current request), so dev links keep `http:` and `:3000`.
 */
export function urlOnHost(origin: string, hostname: string, path = "/") {
  const base = new URL(origin)
  const port = base.port ? `:${base.port}` : ""
  return `${base.protocol}//${hostname}${port}${path}`
}
