/** Discriminator for rows in the shared `auth_tokens` table. */
export enum AuthTokenType {
  EMAIL_VERIFICATION = 'email_verification',
  PASSWORD_RESET = 'password_reset',
}
