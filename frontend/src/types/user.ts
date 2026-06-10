/** Which backend auth surface a session/user belongs to. */
export type AuthKind = "tenant" | "platform";

/**
 * Which in-app surface a tenant user belongs to. Derived (not a backend field):
 * a user with the seeded `"student"` RBAC role uses the student area, everyone
 * else uses the staff dashboard. Centralized here so the rule lives in one place
 * and can later become a real backend field or grow a `"parent"` surface.
 */
export type UserType = "student" | "staff";

/** Single source of truth for the student-vs-staff surface decision. */
export function resolveUserType(roles?: string[]): UserType {
  return roles?.includes("student") ? "student" : "staff";
}

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
export type PlatformAuthUser = BaseUser;

/**
 * Normalized user stored on the NextAuth session. `roles` is optional so a
 * single shape covers tenant (RBAC role names) and platform sessions.
 */
export interface AuthUser extends BaseUser {
  authKind: AuthKind;
  roles?: string[];
  userType?: UserType;
  tenant?: Tenant;
}
