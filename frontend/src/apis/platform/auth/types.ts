/** Platform password-reset data structures. */

/** `data` from `GET /platform/auth/reset-password?token=` — token pre-check. */
export interface ResetTokenInfo {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}
