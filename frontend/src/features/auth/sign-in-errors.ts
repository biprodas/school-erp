/**
 * Why a credentials sign-in failed. `authorize` (src/auth.ts) throws one of
 * these as the `CredentialsSignin` code and `signIn()` hands it back as
 * `result.code`. Being a member of no such school stays `INVALID_CREDENTIALS`,
 * so the form never tells which accounts exist.
 */
export const SIGN_IN_ERROR_MESSAGES = {
  INVALID_CREDENTIALS: "Invalid email or password",
  ACCOUNT_LOCKED:
    "Too many failed sign-ins. Your account is locked for a while, try again later.",
  ACCOUNT_PENDING: "Please verify your email or use your invitation link first.",
  MEMBERSHIP_PENDING:
    "Please activate your account using your invitation link first.",
  EMAIL_NOT_VERIFIED: "Please verify your email before signing in.",
  SERVER_UNAVAILABLE: "Can't reach the server right now. Please try again.",
} as const;

export type SignInErrorCode = keyof typeof SIGN_IN_ERROR_MESSAGES;

export const isSignInErrorCode = (code: unknown): code is SignInErrorCode =>
  typeof code === "string" && code in SIGN_IN_ERROR_MESSAGES;

export const signInErrorMessage = (code: string | undefined): string =>
  isSignInErrorCode(code)
    ? SIGN_IN_ERROR_MESSAGES[code]
    : SIGN_IN_ERROR_MESSAGES.INVALID_CREDENTIALS;

/**
 * The `callbackUrl` to return to after sign-in, if it is a path on this host.
 * Anything else (`https://…`, `//evil.com`, `/\evil.com`) is ignored so a
 * crafted login link can't send someone off-site.
 */
export function safeCallbackUrl(value: string | null): string | null {
  if (!value || !value.startsWith("/") || /^\/[/\\]/.test(value)) return null;
  return value;
}
