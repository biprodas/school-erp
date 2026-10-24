import { NextResponse, type NextRequest } from "next/server"

import {
  HOST_HEADERS,
  HOST_KIND_HEADER,
  REQUEST_ORIGIN_HEADER,
  TENANT_SLUG_HEADER,
} from "~/lib/host-headers"
import { urlOnHost } from "~/lib/hosts"
import { clientInfo } from "~/lib/client-ip"
import { publicEnv } from "~/lib/public-env"
import { resolveHost, type ResolvedHost } from "~/lib/resolve-host"
import { SESSION_COOKIES } from "~/lib/session/cookie"
import {
  ensureFreshSession,
  replaceCookie,
  type CookieUpdate,
  type SessionScope,
} from "~/lib/session/fresh"
import { applyCookieUpdate } from "~/lib/session/response-cookie"

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
 *
 * On school and admin hosts it also refreshes the session when its access
 * token is about to expire, so pages and server actions always render with
 * a working token (server components can't write cookies themselves).
 */
export async function proxy(request: NextRequest) {
  // The Host header, not X-Forwarded-Host: a client can set the latter,
  // and our reverse proxy passes Host through unchanged.
  const hostHeader = request.headers.get("host") ?? ""
  const origin = `${forwardedProto(request)}//${hostHeader}`

  let host: ResolvedHost
  try {
    host = await resolveHost(hostHeader)
  } catch (error) {
    console.error("[proxy] tenant lookup failed", error)
    return rewrite(request, { kind: "unknown", origin }, "/unavailable")
  }

  switch (host.kind) {
    case "site":
      return rewrite(
        request,
        { kind: "site", origin },
        `/site${pathOf(request)}`
      )
    case "unknown":
      return rewrite(request, { kind: "unknown", origin }, "/unknown-school")
    case "moved": {
      const { pathname, search } = request.nextUrl
      const target = `${host.slug}.${publicEnv.rootDomain}`
      return NextResponse.redirect(
        urlOnHost(origin, target, `${pathname}${search}`),
        301
      )
    }
    case "admin": {
      const scope = { realm: "platform", slug: null } as const
      return rewrite(
        request,
        { kind: "admin", origin },
        `/admin${pathOf(request)}`,
        {
          scope,
          update: await freshCookie(request, scope),
        }
      )
    }
    case "school": {
      // Where a school's subdomain will redirect to its primary custom
      // domain (doc/domains-and-routing.md 7.5), once Settings → Domain ships.
      const scope = { realm: "tenant", slug: host.slug } as const
      return rewrite(
        request,
        { kind: "school", origin, slug: host.slug },
        `/school${pathOf(request)}`,
        { scope, update: await freshCookie(request, scope) }
      )
    }
  }
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

/** The session cookie after an early refresh, if one was due. */
async function freshCookie(
  request: NextRequest,
  scope: SessionScope
): Promise<CookieUpdate> {
  const value = request.cookies.get(SESSION_COOKIES[scope.realm])?.value
  if (!value) return { action: "keep" }
  try {
    const { cookie } = await ensureFreshSession(value, scope, {
      client: clientInfo(request.headers),
    })
    return cookie
  } catch (error) {
    console.error("[proxy] session refresh failed", error)
    return { action: "keep" }
  }
}

function rewrite(
  request: NextRequest,
  target: { kind: string; origin: string; slug?: string },
  pathname: string,
  session?: { scope: SessionScope; update: CookieUpdate }
) {
  const url = request.nextUrl.clone()
  url.pathname = pathname

  const headers = new Headers(request.headers)
  for (const name of HOST_HEADERS) headers.delete(name)
  headers.set(HOST_KIND_HEADER, target.kind)
  headers.set(REQUEST_ORIGIN_HEADER, target.origin)
  if (target.slug) headers.set(TENANT_SLUG_HEADER, target.slug)

  // Pages rendered after a refresh read the new cookie, not the old one.
  const update = session?.update
  if (session && update && update.action !== "keep") {
    headers.set(
      "cookie",
      replaceCookie(
        headers.get("cookie"),
        SESSION_COOKIES[session.scope.realm],
        update.action === "set" ? update.value : null
      )
    )
  }

  const response = NextResponse.rewrite(url, { request: { headers } })
  return session && update
    ? applyCookieUpdate(response, session.scope.realm, update)
    : response
}
