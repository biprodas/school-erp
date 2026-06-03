/** Which backend auth surface a session/user belongs to. */
export type AuthKind = "tenant" | "platform";

/** Tenant context attached to tenanted auth responses. */
export interface Tenant {
  id: string;
  slug: string;
  schema: string;
}

/** Fields common to both platform and tenanted users. */
export interface BaseUser {
  id: string;
  email: string;
  name: string;
  status: string;
  isAdmin: boolean;
}

/** User as returned by the tenanted auth endpoints (`/api/auth/*`). */
export interface TenantAuthUser extends BaseUser {
  roles: string[];
}

/** User as returned by the platform auth endpoints (`/api/platform/auth/*`). */
export interface PlatformAuthUser extends BaseUser {
  role: string;
}

/**
 * Normalized user stored on the NextAuth session. `roles`/`role` are both
 * optional so a single shape covers tenant and platform sessions.
 */
export interface AuthUser extends BaseUser {
  authKind: AuthKind;
  role?: string;
  roles?: string[];
  tenant?: Tenant;
}
