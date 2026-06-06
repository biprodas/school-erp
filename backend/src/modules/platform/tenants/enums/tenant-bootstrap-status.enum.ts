/**
 * Tracks how far a tenant's owner-onboarding (bootstrap) has progressed.
 *
 * Step 1 (platform signup) happens before any tenant row exists, so it is
 * tracked by the platform session rather than this column. The values below
 * cover steps 2→4:
 *   - SCHOOL_CREATED  : self-service owner created the school (awaiting activation)
 *   - OWNER_ACTIVATED : self-service owner set their password (awaiting completion)
 *   - ADMIN_INVITED   : a super admin created the tenant + invited the owner;
 *                       the owner only activates, then lands straight on the dashboard
 *   - COMPLETED       : onboarding finished (terminal); also the default for any
 *                       pre-existing/legacy tenant so it is never trapped in the wizard
 */
export enum TenantBootstrapStatus {
  SCHOOL_CREATED = 'school_created',
  OWNER_ACTIVATED = 'owner_activated',
  ADMIN_INVITED = 'admin_invited',
  COMPLETED = 'completed',
}
