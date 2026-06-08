import NextAuth from "next-auth";
import type { NextFetchEvent, NextRequest } from "next/server";
import { authConfigForRequest } from "~/auth.config";

// Next.js 16: `middleware.ts` is now `proxy.ts`. Use the edge-safe config
// (no provider `authorize`) so the `authorized` callback in `auth.config.ts`
// gates every route. Request-aware so cookie names/domain match what `auth.ts`
// sets per host.
const { auth } = NextAuth((request) => authConfigForRequest(request));

// The `authorized` callback handles all gating/redirects; the wrapped function
// is a no-op pass-through.
const authProxy = Promise.resolve(auth(() => undefined));

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
