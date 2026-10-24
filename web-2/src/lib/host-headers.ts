// Request headers `src/proxy.ts` sets for server components and route
// handlers. The proxy removes any copies sent by the client first, so
// downstream code can trust them.

/** `HostKind` of the request's host. */
export const HOST_KIND_HEADER = "x-host-kind"
/** The school's current slug, on school and custom-domain hosts. */
export const TENANT_SLUG_HEADER = "x-tenant-slug"
/** `http://acme.lvh.me:3000`: protocol, host and port the browser used. */
export const REQUEST_ORIGIN_HEADER = "x-request-origin"

export const HOST_HEADERS = [
  HOST_KIND_HEADER,
  TENANT_SLUG_HEADER,
  REQUEST_ORIGIN_HEADER,
] as const
