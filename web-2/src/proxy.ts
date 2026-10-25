import { NextResponse, type NextRequest } from "next/server"

import { appConfig } from "~/config/app-config"
import { securityConfig } from "~/config/security-config"
import {
  HOST_HEADERS,
  HOST_KIND_HEADER,
  NONCE_HEADER,
  REQUEST_ORIGIN_HEADER,
  TENANT_SLUG_HEADER,
} from "~/lib/tenancy/host-headers"
import { urlOnHost } from "~/lib/tenancy/hosts"
import { clientInfo } from "~/lib/security/client-ip"
import { resolveHost, type ResolvedHost } from "~/lib/tenancy/resolve-host"
import {
  contentSecurityPolicy,
  createNonce,
} from "~/lib/security/security-headers"
import { SESSION_COOKIES } from "~/lib/auth/cookie"
import {
  ensureFreshSession,
  readSession,
  replaceCookie,
  type CookieUpdate,
  type FreshSession,
  type SessionScope,
} from "~/lib/auth/fresh"
import { adminGate, gate } from "~/lib/auth/home"
import { applyCookieUpdate } from "~/lib/auth/response-cookie"

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
 * a working token (server components can't write cookies themselves). On
 * school hosts it then applies the sign-in gates (`lib/session/home.ts`):
 * signed out on a protected page, a forced password change, onboarding;
 * on the admin host, everything but sign-in needs a platform session.
 */
export async function proxy(request: NextRequest) {
  // Next renders a server action's redirect target in-process: it re-sends
  // the action's request headers, already rewritten by this proxy, to the
  // server's own origin, so the browser's Host is lost and the page would
  // come from the wrong host's tree. Such a request still carries the host
  // headers this proxy set on the first pass, which browsers never send
  // (one that forges them gets the same answer). Answer it with nothing:
  // Next then navigates on the client, and that request comes back through
  // here with the right Host.
  if (request.headers.has(HOST_KIND_HEADER)) {
    return new NextResponse(null, { status: 204 })
  }

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
      const target = `${host.slug}.${appConfig.rootDomain}`
      return NextResponse.redirect(
        urlOnHost(origin, target, `${pathname}${search}`),
        301
      )
    }
    case "admin": {
      const scope = { realm: "platform", slug: null } as const
      const fresh = await freshSession(request, scope)
      const target = gatedPath(request, fresh, adminGate)
      if (target) {
        return applyCookieUpdate(
          NextResponse.redirect(new URL(target, origin)),
          scope.realm,
          fresh.cookie
        )
      }
      return rewrite(
        request,
        { kind: "admin", origin },
        `/admin${pathOf(request)}`,
        { scope, update: fresh.cookie }
      )
    }
    case "school": {
      // Where a school's subdomain will redirect to its primary custom
      // domain (doc/domains-and-routing.md 7.5), once Settings → Domain ships.
      const scope = { realm: "tenant", slug: host.slug } as const
      const fresh = await freshSession(request, scope)
      const target = gatedPath(request, fresh)
      if (target) {
        return applyCookieUpdate(
          NextResponse.redirect(new URL(target, origin)),
          scope.realm,
          fresh.cookie
        )
      }
      return rewrite(
        request,
        { kind: "school", origin, slug: host.slug },
        `/school${pathOf(request)}`,
        { scope, update: fresh.cookie }
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

/** The session, after an early refresh if one was due. */
async function freshSession(
  request: NextRequest,
  scope: SessionScope
): Promise<FreshSession> {
  const value = request.cookies.get(SESSION_COOKIES[scope.realm])?.value
  try {
    return await ensureFreshSession(value, scope, {
      client: clientInfo(request.headers),
    })
  } catch (error) {
    console.error("[proxy] session refresh failed", error)
    const session = await readSession(value, scope).catch(() => null)
    return { session, cookie: { action: "keep" } }
  }
}

/**
 * Where a page request has to go instead (sign-in, a forced password
 * change, onboarding), or null. Only navigations are redirected: server
 * actions (POST) check the session themselves.
 */
function gatedPath(
  request: NextRequest,
  fresh: FreshSession,
  rules: typeof gate = gate
): string | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null
  const { pathname, search } = request.nextUrl
  return rules(fresh.session, `${pathname}${search}`)
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

  // A fresh nonce per page: Next.js reads it from the request's CSP and
  // puts it on its scripts; the root layout passes it to the theme script.
  const nonce = createNonce()
  const csp = contentSecurityPolicy(nonce, securityConfig)
  headers.set(NONCE_HEADER, nonce)
  headers.set("content-security-policy", csp)

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
  response.headers.set("content-security-policy", csp)
  return session && update
    ? applyCookieUpdate(response, session.scope.realm, update)
    : response
}
