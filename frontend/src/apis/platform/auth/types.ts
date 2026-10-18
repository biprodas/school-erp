/** Platform password-reset data structures. */

/** `data` from `GET /platform/auth/reset-password?token=` — token pre-check. */
export interface ResetTokenInfo {
  email: string;
}

/** `data` from `POST /platform/auth/handoff` — a one-time cross-host sign-in code. */
export interface HandoffCode {
  code: string;
  orgSlug: string;
  expiresAt: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}
