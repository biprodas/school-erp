import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfigForRequest } from "~/auth.config";
import { AUTH_ENDPOINTS } from "~/config";
import { backendPost } from "~/lib/api/backend";
import type { PlatformAuthData, TenantAuthData } from "~/types/api";

// Request-aware config so the cookie Domain is chosen per host (`.lvh.me` on
// lvh.me subdomains, host-only on localhost).
export const { handlers, auth, signIn, signOut } = NextAuth((request) => ({
  ...authConfigForRequest(request),
  providers: [
    Credentials({
      id: "tenant-credentials",
      name: "Tenant",
      credentials: {
        email: {},
        password: {},
        tenantSlug: {},
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        const tenantSlug = credentials?.tenantSlug as string | undefined;
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
            tenant: data.tenant,
          };
        } catch (err) {
          console.error("tenant-credentials authorize failed:", err);
          return null;
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
            role: data.user.role,
            accessToken: data.access_token,
            authKind: "platform",
          };
        } catch (err) {
          console.error("platform-credentials authorize failed:", err);
          return null;
        }
      },
    }),
  ],
}));
