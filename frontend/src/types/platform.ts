/**
 * Shapes for the platform (super-admin) management surface, mirroring the
 * NestJS `modules/platform/*` entities and enums.
 */

export const TENANT_STATUSES = [
  "pending",
  "active",
  "inactive",
  "suspended",
  "archived",
] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const USER_STATUSES = [
  "pending",
  "active",
  "suspended",
  "deactivated",
  "banned",
] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const PLATFORM_ROLES = ["admin", "user"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const MEMBERSHIP_ROLES = ["owner", "admin", "member"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

/** What happens to the previous owner on a tenant ownership transfer. */
export const DEMOTE_OPTIONS = ["admin", "member", "remove"] as const;
export type DemoteOldOwnerTo = (typeof DEMOTE_OPTIONS)[number];

export interface PlatformTenant {
  id: string;
  name: string;
  slug: string;
  schemaName: string;
  domain: string | null;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformUserRow {
  id: string;
  email: string;
  name: string;
  role: PlatformRole;
  status: UserStatus;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Membership {
  id: string;
  userId: string;
  tenantId: string;
  role: MembershipRole;
  createdAt: string;
  updatedAt: string;
}

// ---- Request payloads ----

export interface CreateTenantPayload {
  name: string;
  slug: string;
  domain?: string;
  ownerUserId?: string;
}

export interface UpdateTenantPayload {
  name?: string;
  domain?: string;
  status?: TenantStatus;
}

export interface TransferOwnershipPayload {
  newOwnerUserId: string;
  demoteOldOwnerTo?: DemoteOldOwnerTo;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role?: PlatformRole;
  status?: UserStatus;
  isAdmin?: boolean;
}

export interface UpdateUserPayload {
  name?: string;
  role?: PlatformRole;
  status?: UserStatus;
  isAdmin?: boolean;
}

export interface CreateMembershipPayload {
  userId: string;
  tenantId: string;
  role?: MembershipRole;
}

export interface UpdateMembershipRolePayload {
  role: MembershipRole;
}
