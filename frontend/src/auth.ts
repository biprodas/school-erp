import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "~/auth.config";
import { AUTH_ENDPOINTS, apiConfig } from "~/config/api-config";
import { BackendError, backendPost } from "~/lib/api/backend";
import {
  isSignInErrorCode,
  type SignInErrorCode,
} from "~/features/auth/sign-in-errors";
import type { PlatformAuthData, TenantAuthData } from "~/types/api";

/**
 * A failed credentials sign-in. Auth.js hands `code` back to `signIn()` as
 * `result.code`, which the login forms turn into a message.
 */
class SignInFailed extends CredentialsSignin {
  constructor(code: SignInErrorCode) {
    super();
    this.code = code;
  }
}

/** Maps a failed backend call to the code the login form shows. */
function signInErrorCode(err: unknown): SignInErrorCode {
  if (!(err instanceof BackendError)) return "SERVER_UNAVAILABLE";
  if (err.status >= 500) return "SERVER_UNAVAILABLE";
  return isSignInErrorCode(err.code) ? err.code : "INVALID_CREDENTIALS";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "tenant-credentials",
      name: "Tenant",
      credentials: {
        email: {},
        password: {},
        tenantSlug: {},
      },
      async authorize(credentials, request) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        // Slug source: the form's resolved value, or an edge/proxy-injected
        // `x-tenant-id` header (custom domains in production — no client work).
        const tenantSlug =
          (credentials?.tenantSlug as string | undefined)?.trim() ||
          request?.headers?.get(apiConfig.tenantHeader)?.trim() ||
          undefined;
        if (!email || !password || !tenantSlug) return null;

        try {
          const data = await backendPost<TenantAuthData>(
            AUTH_ENDPOINTS.tenant.login,
            { email, password },
            { tenantSlug },
          );
          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            isAdmin: data.user.isAdmin,
            roles: data.user.roles,
            accessToken: data.access_token,
            authKind: "tenant",
            organization: data.organization,
          };
        } catch (err) {
          console.error("tenant-credentials authorize failed:", err);
          throw new SignInFailed(signInErrorCode(err));
        }
      },
    }),
    // Cross-host sign-in: redeems a one-time code issued on another host
    // (e.g. the platform apex) for a session on this school host. Only used
    // server-side by `app/auth/handoff/route.ts`.
    Credentials({
      id: "handoff",
      name: "Handoff",
      credentials: {
        code: {},
        tenantSlug: {},
      },
      async authorize(credentials) {
        const code = credentials?.code as string | undefined;
        const tenantSlug = (credentials?.tenantSlug as string | undefined)?.trim();
        if (!code || !tenantSlug) return null;

        try {
          const data = await backendPost<TenantAuthData>(
            AUTH_ENDPOINTS.tenant.handoff,
            { code },
            { tenantSlug },
          );
          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            isAdmin: data.user.isAdmin,
            roles: data.user.roles,
            accessToken: data.access_token,
            authKind: "tenant",
            organization: data.organization,
          };
        } catch (err) {
          console.error("handoff authorize failed:", err);
          throw new SignInFailed(signInErrorCode(err));
        }
      },
    }),
    Credentials({
      id: "platform-credentials",
      name: "Platform",
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        try {
          const data = await backendPost<PlatformAuthData>(
            AUTH_ENDPOINTS.platform.login,
            { email, password },
          );

          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            isAdmin: data.user.isAdmin,
            accessToken: data.access_token,
            authKind: "platform",
          };
        } catch (err) {
          console.error("platform-credentials authorize failed:", err);
          throw new SignInFailed(signInErrorCode(err));
        }
      },
    }),
  ],
});
