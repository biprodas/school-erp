import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";
import { ROUTES, isAuthRoute, isProtectedRoute } from "~/constants";

/**
 * Optional shared cookie domain so the session can span tenant subdomains
 * (`.lvh.me` in dev, `.yourapp.com` in prod). It is applied **per request**
 * (see `cookieConfig`) only when the request host is actually under that
 * domain — otherwise cookies stay host-only, so `localhost` keeps working.
 */
const BASE_COOKIE_DOMAIN = process.env.AUTH_COOKIE_DOMAIN || undefined;
const USE_SECURE_COOKIES = process.env.NODE_ENV === "production";
const COOKIE_PREFIX = USE_SECURE_COOKIES ? "__Secure-" : "";

/** Cookie `Domain` for a host: the shared domain only when the host is under
 *  it (e.g. `acme.lvh.me`/`lvh.me`); `undefined` (host-only) otherwise. */
export function cookieDomainForHost(
  host: string | null | undefined,
): string | undefined {
  if (!BASE_COOKIE_DOMAIN || !host) return undefined;
  const hostname = host.split(":")[0].toLowerCase();
  const bare = BASE_COOKIE_DOMAIN.replace(/^\./, "");
  if (hostname === bare || hostname.endsWith(`.${bare}`)) {
    return BASE_COOKIE_DOMAIN;
  }
  return undefined;
}

/**
 * NextAuth `cookies` config for a given request host. Names are host-independent
 * (so a session set on one request is readable on another); only the `Domain`
 * varies. We use `authjs.csrf-token` (not the default `__Host-` name) because
 * the `__Host-` prefix forbids a `Domain` attribute.
 */
export function cookieConfig(host: string | null | undefined) {
  const options = {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: USE_SECURE_COOKIES,
    domain: cookieDomainForHost(host),
  } as const;
  return {
    sessionToken: { name: `${COOKIE_PREFIX}authjs.session-token`, options },
    callbackUrl: { name: `${COOKIE_PREFIX}authjs.callback-url`, options },
    csrfToken: { name: `${COOKIE_PREFIX}authjs.csrf-token`, options },
  };
}

/** Per-request config: merge the host-aware cookies onto the base config. */
export function authConfigForRequest(
  request?: { headers: Headers } | undefined,
): NextAuthConfig {
  return {
    ...authConfig,
    cookies: cookieConfig(request?.headers.get("host")),
  };
}

/**
 * Edge-safe base config shared by the proxy (`src/proxy.ts`) and the full
 * NextAuth instance (`src/auth.ts`). Contains NO provider `authorize` logic so
 * it never pulls Node-only modules into the edge bundle.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  useSecureCookies: USE_SECURE_COOKIES,
  pages: {
    signIn: ROUTES.TENANT_LOGIN,
  },
  providers: [],
  callbacks: {
    authorized({ request, auth }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      // Authenticated users shouldn't see auth pages — send to their dashboard
      // based on which surface they're signed into.
      if (isAuthRoute(pathname)) {
        if (isLoggedIn) {
          const target =
            auth?.authKind === "platform"
              ? ROUTES.PLATFORM_LOGIN_REDIRECT
              : ROUTES.DEFAULT_LOGIN_REDIRECT;
          return NextResponse.redirect(new URL(target, request.nextUrl));
        }
        return true;
      }

      // Gate protected areas; the host renders the right login surface.
      if (isProtectedRoute(pathname) && !isLoggedIn) {
        const loginUrl = new URL(ROUTES.TENANT_LOGIN, request.nextUrl);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.accessToken = user.accessToken;
        token.authKind = user.authKind;
        token.roles = user.roles;
        token.isAdmin = user.isAdmin;
        token.tenant = user.tenant;
      }
      return token;
    },
    session({ session, token }) {
      session.accessToken = token.accessToken;
      session.authKind = token.authKind;
      session.user.id = token.sub ?? session.user.id;
      session.user.roles = token.roles;
      session.user.isAdmin = token.isAdmin;
      session.user.tenant = token.tenant;
      return session;
    },
  },
} satisfies NextAuthConfig;
