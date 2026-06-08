import type { DefaultSession } from "next-auth";
import type { TenantBootstrapStatus } from "~/apis/platform/tenants/types";
import type { AuthKind, Tenant } from "~/types/user";

/**
 * Module augmentation so `session`, `user`, and the JWT carry the backend
 * access token and the normalized auth context.
 */
declare module "next-auth" {
  interface Session {
    accessToken: string;
    authKind: AuthKind;
    /** Platform owner onboarding progress; `null` = no school yet. */
    onboardingBootstrapStatus?: TenantBootstrapStatus | null;
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
    onboardingBootstrapStatus?: TenantBootstrapStatus | null;
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
    onboardingBootstrapStatus?: TenantBootstrapStatus | null;
  }
}
