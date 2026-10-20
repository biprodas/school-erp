/**
 * Audited action names (`<area>.<event>`). Stored as text, so new actions
 * need no migration; keep them here so filters and the frontend share one
 * list.
 */
export const AUDIT_ACTIONS = {
  // Sign-in and sessions (both realms)
  LOGIN: 'auth.login',
  LOGIN_FAILED: 'auth.login_failed',
  ACCOUNT_LOCKED: 'auth.account_locked',
  ACCOUNT_ACTIVATED: 'auth.account_activated',
  PASSWORD_CHANGED: 'auth.password_changed',
  PASSWORD_RESET: 'auth.password_reset',
  LOGOUT: 'auth.logout',
  LOGOUT_ALL: 'auth.logout_all',
  SESSION_REVOKED: 'auth.session_revoked',

  // Roles and permissions
  ROLE_CREATED: 'role.created',
  ROLE_UPDATED: 'role.updated',
  ROLE_DELETED: 'role.deleted',
  ROLE_ASSIGNED: 'role.assigned',
  ROLE_UNASSIGNED: 'role.unassigned',

  // School members
  MEMBER_ADDED: 'member.added',
  MEMBER_UPDATED: 'member.updated',
  MEMBER_REMOVED: 'member.removed',
  MEMBER_ADMIN_GRANTED: 'member.admin_granted',
  MEMBER_ADMIN_REVOKED: 'member.admin_revoked',

  // Settings
  SETTINGS_UPDATED: 'settings.updated',

  // Sensitive data access (PRD 6.3). Recorded without the data itself.
  STUDENT_MEDICAL_VIEWED: 'student_medical.viewed',
  STUDENT_NOTE_SENSITIVE_VIEWED: 'student_note.sensitive_viewed',

  // Platform
  ORGANIZATION_CREATED: 'organization.created',
  ORGANIZATION_UPDATED: 'organization.updated',
  ORGANIZATION_DELETED: 'organization.deleted',
  ORGANIZATION_OWNER_TRANSFERRED: 'organization.owner_transferred',
  MEMBERSHIP_CREATED: 'membership.created',
  MEMBERSHIP_UPDATED: 'membership.updated',
  MEMBERSHIP_REMOVED: 'membership.removed',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
