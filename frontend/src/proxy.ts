import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { authConfigForRequest } from "~/auth.config";
import {
  PLATFORM_LOGIN_REDIRECT,
  isOnboardingPath,
  isPlatformPath,
} from "~/constants/routes";
import { resolveOwnerDestinationFromBootstrap } from "~/features/onboarding/resolve-destination";

// Next.js 16: `middleware.ts` is now `proxy.ts`. Use the edge-safe config
// (no provider `authorize`) so the `authorized` callback gates every route.
// Request-aware so cookie names/domain match what `auth.ts` sets per host.
const { auth } = NextAuth((request) => authConfigForRequest(request));

// Onboarding routing reads `onboardingBootstrapStatus` from the JWT — no API
// fetch — so redirects are synchronous and cheap on every navigation.
const authProxy = Promise.resolve(
  auth((req) => {
    const session = req.auth;
    const { pathname } = req.nextUrl;

    if (
      session?.authKind !== "platform" ||
      session.user.isAdmin
    ) {
      return;
    }

    if (!isPlatformPath(pathname) && !isOnboardingPath(pathname)) {
      return;
    }

    // Legacy sessions minted before this field existed — server layouts hydrate.
    if (session.onboardingBootstrapStatus === undefined) {
      return;
    }

    const destination = resolveOwnerDestinationFromBootstrap(
      session.onboardingBootstrapStatus,
    );

    if (pathname === destination) return;

    if (
      isPlatformPath(pathname) &&
      destination !== PLATFORM_LOGIN_REDIRECT
    ) {
      return NextResponse.redirect(new URL(destination, req.nextUrl));
    }

    if (
      isOnboardingPath(pathname) &&
      (destination === PLATFORM_LOGIN_REDIRECT || pathname !== destination)
    ) {
      return NextResponse.redirect(new URL(destination, req.nextUrl));
    }
  }),
);

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const handler = (await authProxy) as unknown as (
    request: NextRequest,
    event: NextFetchEvent,
  ) => Promise<Response | undefined>;
  return handler(request, event);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$|favicon.ico).*)"],
};
