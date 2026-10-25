import {
  PlatformRole,
  isPlatformRole,
} from '~/modules/users/enums/platform-role.enum';

/**
 * What platform staff may do in the console (the admin host), by platform
 * role. Code-defined like the school catalog (`rbac/permissions.catalog.ts`),
 * but there are no stored platform roles: a user's `platform_role` decides,
 * so changing a role's grants here needs no data migration. Endpoints ask
 * with `@RequirePlatformPermissions(...)`, services with `platformCan`.
 */
export const PLATFORM_PERMISSIONS = {
  /** Sign in to the platform console at all. */
  CONSOLE_ACCESS: 'console:access',
  /** The school directory, any school's details and memberships. */
  ORGANIZATIONS_READ: 'organizations:read',
  /** Support actions on a school: resend the owner's activation link. */
  ORGANIZATIONS_SUPPORT: 'organizations:support',
  /** Create, edit, suspend and delete schools; plans, trials, limits, owners and memberships. */
  ORGANIZATIONS_MANAGE: 'organizations:manage',
  PLANS_READ: 'plans:read',
  /** The platform staff list. */
  PLATFORM_USERS_READ: 'platform_users:read',
  /** Add, edit, block and remove platform staff, and set their roles. */
  PLATFORM_USERS_MANAGE: 'platform_users:manage',
  /** The platform audit log. */
  AUDIT_READ: 'audit:read',
} as const;

export type PlatformPermission =
  (typeof PLATFORM_PERMISSIONS)[keyof typeof PLATFORM_PERMISSIONS];

const P = PLATFORM_PERMISSIONS;
const ALL = Object.values(P);

/**
 * The grants of each platform role. `super_admin` has everything; `admin`
 * runs the schools but can't change platform staff (so nobody can promote
 * themselves); `support` sees everything and can help an owner sign in;
 * `developer` only sees; `user` (everyone else) has no console.
 */
export const PLATFORM_ROLE_PERMISSIONS: Record<
  PlatformRole,
  readonly PlatformPermission[]
> = {
  [PlatformRole.SUPER_ADMIN]: ALL,
  [PlatformRole.ADMIN]: ALL.filter((key) => key !== P.PLATFORM_USERS_MANAGE),
  [PlatformRole.SUPPORT]: [
    P.CONSOLE_ACCESS,
    P.ORGANIZATIONS_READ,
    P.ORGANIZATIONS_SUPPORT,
    P.PLANS_READ,
    P.AUDIT_READ,
  ],
  [PlatformRole.DEVELOPER]: [
    P.CONSOLE_ACCESS,
    P.ORGANIZATIONS_READ,
    P.PLANS_READ,
    P.AUDIT_READ,
  ],
  [PlatformRole.USER]: [],
};

/** The grants of `role`; none for a missing or unknown role. */
export function platformPermissionsOf(
  role: unknown,
): readonly PlatformPermission[] {
  return isPlatformRole(role) ? PLATFORM_ROLE_PERMISSIONS[role] : [];
}

/** Whether `role` holds `permission`. */
export function platformCan(
  role: unknown,
  permission: PlatformPermission,
): boolean {
  return platformPermissionsOf(role).includes(permission);
}
