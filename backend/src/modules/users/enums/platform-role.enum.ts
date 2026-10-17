/**
 * A user's role on the platform (not inside a school). Only
 * {@link PLATFORM_ADMIN_ROLES} grant platform admin access (`users.is_admin`).
 */
export enum PlatformRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  SUPPORT = 'support',
  DEVELOPER = 'developer',
  USER = 'user',
}

export const PLATFORM_ADMIN_ROLES: readonly PlatformRole[] = [
  PlatformRole.SUPER_ADMIN,
  PlatformRole.ADMIN,
];
