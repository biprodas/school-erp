/** How long a password-reset token stays valid (1 hour). */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/** How long an email-verification token stays valid (24 hours). */
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

/** How long a cross-host sign-in handoff code stays valid (60 seconds). */
export const HANDOFF_TTL_MS = 60 * 1000;

/** How long an org-activation token stays valid (7 days). */
export const ACTIVATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
