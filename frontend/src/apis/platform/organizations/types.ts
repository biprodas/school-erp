/** Organization (school) data structures, mirroring the NestJS platform organization entity/DTOs. */

export const ORGANIZATION_STATUSES = [
  "pending",
  "active",
  "inactive",
  "suspended",
  "archived",
] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

/** What happens to the previous owner on an organization ownership transfer. */
export const DEMOTE_OPTIONS = ["admin", "member", "remove"] as const;
export type DemoteOldOwnerTo = (typeof DEMOTE_OPTIONS)[number];

export interface PlatformOrganization {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  status: OrganizationStatus;
  createdAt: string;
  updatedAt: string;
}

/** One-time owner activation handed back when an owner is (re)provisioned. */
export interface OwnerActivation {
  token: string;
  orgSlug: string;
}

/** Create-organization response: the organization plus an optional owner activation link. */
export interface CreateOrganizationResult extends PlatformOrganization {
  activation: OwnerActivation | null;
}

export interface CreateOrganizationPayload {
  name: string;
  slug: string;
  domain?: string;
  ownerUserId?: string;
}

export interface UpdateOrganizationPayload {
  name?: string;
  domain?: string;
  status?: OrganizationStatus;
}

export interface TransferOwnershipPayload {
  newOwnerUserId: string;
  demoteOldOwnerTo?: DemoteOldOwnerTo;
}
