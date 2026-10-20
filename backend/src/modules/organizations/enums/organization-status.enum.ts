export enum OrganizationStatus {
  PENDING = 'pending',
  /** Self-serve signup within its trial (`trial_ends_at`). */
  TRIAL = 'trial',
  ACTIVE = 'active',
  /** Subscription unpaid; still usable until it becomes suspended (1b). */
  PAST_DUE = 'past_due',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  ARCHIVED = 'archived',
}

/** Statuses in which a school's hosts resolve and its users can work. */
export const OPERATIONAL_ORGANIZATION_STATUSES: ReadonlySet<OrganizationStatus> =
  new Set([
    OrganizationStatus.TRIAL,
    OrganizationStatus.ACTIVE,
    OrganizationStatus.PAST_DUE,
  ]);

export function isOperationalOrganization(status: OrganizationStatus): boolean {
  return OPERATIONAL_ORGANIZATION_STATUSES.has(status);
}
