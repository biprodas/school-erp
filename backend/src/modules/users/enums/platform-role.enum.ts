/**
 * A user's role on the platform (not inside a school). It alone decides
 * what they may do in the platform console: see `PLATFORM_ROLE_PERMISSIONS`
 * (`~/common/auth/platform-permissions`). `user` is everyone without one.
 */
export enum PlatformRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  SUPPORT = 'support',
  DEVELOPER = 'developer',
  USER = 'user',
}

const ROLES = new Set<string>(Object.values(PlatformRole));

export const isPlatformRole = (value: unknown): value is PlatformRole =>
  typeof value === 'string' && ROLES.has(value);
