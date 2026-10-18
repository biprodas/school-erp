import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";
import {
  ROUTES,
  isAuthRoute,
  isProtectedRoute,
  isStudentPath,
  resolveTenantLanding,
} from "~/constants";
import { resolveUserType } from "~/types/user";

const USE_SECURE_COOKIES = process.env.NODE_ENV === "production";

/**
 * Edge-safe base config shared by the proxy (`src/proxy.ts`) and the full
 * NextAuth instance (`src/auth.ts`). Contains NO provider `authorize` logic so
 * it never pulls Node-only modules into the edge bundle.
 *
 * Session cookies use the Auth.js defaults, which are host-only (no `Domain`):
 * every school host (subdomain or custom domain) keeps its own session, so
 * signing in to one school never replaces the session of another. Moving
 * between hosts goes through a one-time handoff code (`/auth/handoff`).
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

      // Authenticated users shouldn't see auth pages — send to their landing
      // page based on surface (platform vs tenant) and, for tenants, role.
      if (isAuthRoute(pathname)) {
        if (isLoggedIn) {
          const target =
            auth?.authKind === "platform"
              ? ROUTES.PLATFORM_LOGIN_REDIRECT
              : resolveTenantLanding(auth?.user?.roles);
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

      // Hard-separate the two tenant surfaces: students stay in `/student/*`,
      // staff stay in the dashboard. Platform users are gated by `authKind`.
      if (isLoggedIn && auth?.authKind === "tenant") {
        const userType = resolveUserType(auth.user?.roles);
        if (
          userType === "student" &&
          isProtectedRoute(pathname) &&
          !isStudentPath(pathname)
        ) {
          return NextResponse.redirect(
            new URL(ROUTES.STUDENT_LOGIN_REDIRECT, request.nextUrl),
          );
        }
        if (userType === "staff" && isStudentPath(pathname)) {
          return NextResponse.redirect(
            new URL(ROUTES.DEFAULT_LOGIN_REDIRECT, request.nextUrl),
          );
        }
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.accessToken = user.accessToken;
        token.authKind = user.authKind;
        token.roles = user.roles;
        token.isAdmin = user.isAdmin;
        token.organization = user.organization;
      }
      return token;
    },
    session({ session, token }) {
      session.accessToken = token.accessToken;
      session.authKind = token.authKind;
      session.user.id = token.sub ?? session.user.id;
      session.user.roles = token.roles;
      session.user.userType = resolveUserType(token.roles);
      session.user.isAdmin = token.isAdmin;
      session.user.organization = token.organization;
      return session;
    },
  },
} satisfies NextAuthConfig;
