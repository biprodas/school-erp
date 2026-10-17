/** A user's standing inside one organization (independent of their global account status). */
export enum MembershipStatus {
  PENDING = 'pending', // invited/provisioned, must activate before logging in
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DEACTIVATED = 'deactivated',
}
