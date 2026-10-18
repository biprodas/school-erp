import NextAuth from "next-auth";
import { authConfig } from "~/auth.config";

// Next.js 16: `middleware.ts` is now `proxy.ts`. Use the edge-safe config
// (no provider `authorize`) so the `authorized` callback gates every route.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Run on everything except Next internals, the auth API, and static files.
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$|favicon.ico).*)"],
};