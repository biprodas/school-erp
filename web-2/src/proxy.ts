import { NextResponse, type NextRequest } from "next/server"

import { serverEnv } from "~/lib/env"
import {
  HOST_HEADERS,
  HOST_KIND_HEADER,
  REQUEST_ORIGIN_HEADER,
  TENANT_SLUG_HEADER,
} from "~/lib/host-headers"
import { classifyHost, urlOnHost, type HostInfo } from "~/lib/hosts"
import { publicEnv } from "~/lib/public-env"
import { lookupTenant } from "~/lib/tenant"

/**
 * One app serves every host (doc/domains-and-routing.md, section 1). The
 * proxy works out what the host is and rewrites the request into that
 * host's internal tree, so the browser URL stays clean:
 *
 *   lvh.me/pricing          → /site/pricing
 *   admin.lvh.me/           → /admin
 *   acme.lvh.me/login       → /school/login
 *   erp.acme-school.com/    → /school       (custom domain)
 *
 * Every path is prefixed, so the internal trees can't be requested
 * directly: `/school/login` typed on any host becomes `/<tree>/school/login`
 * and 404s.
 */
export async function proxy(request: NextRequest) {
  // The Host header, not X-Forwarded-Host: a client can set the latter,
  // and our reverse proxy passes Host through unchanged.
  const host = request.headers.get("host") ?? ""
  const info = classifyHost(host, publicEnv)
  const origin = `${forwardedProto(request)}//${host}`

  switch (info.kind) {
    case "site":
      return rewrite(request, info, origin, `/site${pathOf(request)}`)
    case "admin":
      return rewrite(request, info, origin, `/admin${pathOf(request)}`)
    case "unknown":
      return rewrite(request, info, origin, "/unknown-school")
  }

  let tenant
  try {
    tenant = await lookupTenant(info, { apiUrl: serverEnv().API_URL })
  } catch (error) {
    console.error("[proxy] tenant lookup failed", error)
    return rewrite(request, info, origin, "/unavailable")
  }

  if (tenant.status === "not-found") {
    const unknown = { kind: "unknown", hostname: info.hostname } as const
    return rewrite(request, unknown, origin, "/unknown-school")
  }
  if (tenant.status === "moved") {
    const { pathname, search } = request.nextUrl
    const target = `${tenant.slug}.${publicEnv.rootDomain}`
    return NextResponse.redirect(
      urlOnHost(origin, target, `${pathname}${search}`),
      301
    )
  }

  // Where a school's subdomain will redirect to its primary custom domain
  // (doc/domains-and-routing.md 7.5), once Settings → Domain ships.
  return rewrite(
    request,
    info,
    origin,
    `/school${pathOf(request)}`,
    tenant.slug
  )
}

export const config = {
  matcher: [
    // Everything except the BFF (`/api/*`), Next internals and files
    // (anything with a dot: icons, images, `robots.txt`, …).
    "/((?!api/|_next/|apple-icon|.*\\..*).*)",
  ],
}

/** `/` stays empty so `/site` + `/` is the tree's own index page. */
function pathOf(request: NextRequest) {
  const { pathname } = request.nextUrl
  return pathname === "/" ? "" : pathname
}

function forwardedProto(request: NextRequest) {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim()
  return proto ? `${proto}:` : request.nextUrl.protocol
}

function rewrite(
  request: NextRequest,
  info: HostInfo,
  origin: string,
  pathname: string,
  slug?: string
) {
  const url = request.nextUrl.clone()
  url.pathname = pathname

  const headers = new Headers(request.headers)
  for (const name of HOST_HEADERS) headers.delete(name)
  headers.set(HOST_KIND_HEADER, info.kind === "custom" ? "school" : info.kind)
  headers.set(REQUEST_ORIGIN_HEADER, origin)
  if (slug) headers.set(TENANT_SLUG_HEADER, slug)

  return NextResponse.rewrite(url, { request: { headers } })
}
