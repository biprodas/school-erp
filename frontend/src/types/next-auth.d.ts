import type { DefaultSession } from "next-auth";
import type { AuthKind, Tenant } from "~/types/user";

/**
 * Module augmentation so `session`, `user`, and the JWT carry the backend
 * access token and the normalized auth context.
 */
declare module "next-auth" {
  interface Session {
    accessToken: string;
    authKind: AuthKind;
    user: {
      id: string;
      roles?: string[];
      isAdmin: boolean;
      tenant?: Tenant;
    } & DefaultSession["user"];
  }

  interface User {
    accessToken: string;
    authKind: AuthKind;
    roles?: string[];
    isAdmin: boolean;
    tenant?: Tenant;
  }
}

// JWT lives in `@auth/core/jwt` (next-auth/jwt only re-exports it), so the
// augmentation must target the original module to merge with the interface.
declare module "@auth/core/jwt" {
  interface JWT {
    accessToken: string;
    authKind: AuthKind;
    roles?: string[];
    isAdmin: boolean;
    tenant?: Tenant;
  }
}
