/** Tenant data structures, mirroring the NestJS platform tenant entity/DTOs. */

export const TENANT_STATUSES = [
  "pending",
  "active",
  "inactive",
  "suspended",
  "archived",
] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

/** Owner-onboarding (bootstrap) progress — mirrors the backend enum. */
export const TENANT_BOOTSTRAP_STATUSES = [
  "school_created",
  "owner_activated",
  "admin_invited",
  "completed",
] as const;
export type TenantBootstrapStatus =
  (typeof TENANT_BOOTSTRAP_STATUSES)[number];

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
  bootstrapStatus: TenantBootstrapStatus;
  createdAt: string;
  updatedAt: string;
}

/** One-time owner activation handed back when an owner is (re)provisioned. */
export interface OwnerActivation {
  token: string;
  tenantSlug: string;
}

/** Create-tenant response: the tenant plus an optional owner activation link. */
export interface CreateTenantResult extends PlatformTenant {
  activation: OwnerActivation | null;
}

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
