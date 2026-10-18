/**
 * Lifecycle of a custom domain (see doc/domains-and-routing.md, section 7).
 * Only `verified` and `active` domains resolve to their school.
 */
export enum DomainStatus {
  /** Added; waiting for the CNAME and TXT records. */
  PENDING = 'pending',
  /** DNS ownership proven; certificate not issued yet. */
  VERIFIED = 'verified',
  /** Verified and serving with a certificate. */
  ACTIVE = 'active',
  /** DNS checks failed or the school removed the records. */
  INACTIVE = 'inactive',
}

/** Statuses whose hostname resolves to the school. */
export const RESOLVABLE_DOMAIN_STATUSES = [
  DomainStatus.VERIFIED,
  DomainStatus.ACTIVE,
] as const;
