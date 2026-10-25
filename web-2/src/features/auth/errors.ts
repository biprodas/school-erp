import { dateOptionsFor, formatDateTime } from "~/lib/format"

/** Keys under `authErrors` in the message catalogs. */
export type AuthErrorKey =
  | "invalidCredentials"
  | "accountLocked"
  | "accountPending"
  | "accountBlocked"
  | "membershipPending"
  | "accessEnded"
  | "sessionEnded"
  | "passwordChangeRequired"
  | "linkInvalid"
  | "tooManyAttempts"
  | "network"
  | "handoff"
  | "googleNoAccount"
  | "googleEmailUnverified"
  | "googleExpired"
  | "googleCancelled"
  | "googleFailed"
  | "googleDisabled"
  | "googleEmailMismatch"
  | "googleAlreadyLinked"
  | "notPlatformAdmin"
  | "unknown"

type Translate = (key: AuthErrorKey, values?: { time: string }) => string

/**
 * `?error=` values the sign-in page understands: from the handoff route
 * and from Google sign-in (`GOOGLE_ERRORS` in the backend's
 * `google-auth.service.ts`).
 */
const QUERY_ERRORS: Record<string, AuthErrorKey> = {
  handoff: "handoff",
  google_no_account: "googleNoAccount",
  google_email_unverified: "googleEmailUnverified",
  google_expired: "googleExpired",
  google_cancelled: "googleCancelled",
  google_failed: "googleFailed",
  google_disabled: "googleDisabled",
  google_already_linked: "googleAlreadyLinked",
  // The admin host refused a Google sign-in by a non-admin.
  not_admin: "notPlatformAdmin",
}

/** The message for a `?error=` value, or null for one we don't know. */
export const queryErrorKey = (value: string | null | undefined) =>
  value && Object.hasOwn(QUERY_ERRORS, value) ? QUERY_ERRORS[value] : null

/** Backend error code (`doc/error-codes.md`) → message key. */
export function authErrorKey(code: string): AuthErrorKey {
  switch (code) {
    case "INVALID_CREDENTIALS":
      return "invalidCredentials"
    case "ACCOUNT_LOCKED":
      return "accountLocked"
    case "ACCOUNT_PENDING":
      return "accountPending"
    case "ACCOUNT_SUSPENDED":
    case "ACCOUNT_DEACTIVATED":
    case "ACCOUNT_BANNED":
      return "accountBlocked"
    case "MEMBERSHIP_PENDING":
      return "membershipPending"
    case "SESSION_REVOKED":
    case "SESSION_EXPIRED":
      return "sessionEnded"
    case "PASSWORD_CHANGE_REQUIRED":
      return "passwordChangeRequired"
    // Token links (activation, reset, verification, handoff) answer a
    // plain 400 when they are unknown, used or expired.
    case "BAD_REQUEST":
    case "INVALID_SIGNUP_LINK":
      return "linkInvalid"
    // Signup with Google.
    case "INVALID_GOOGLE_TICKET":
      return "googleExpired"
    case "GOOGLE_EMAIL_MISMATCH":
      return "googleEmailMismatch"
    case "GOOGLE_ALREADY_LINKED":
      return "googleAlreadyLinked"
    case "PLATFORM_ADMIN_REQUIRED":
      return "notPlatformAdmin"
    case "TOO_MANY_REQUESTS":
      return "tooManyAttempts"
    case "NETWORK_ERROR":
    case "BAD_GATEWAY":
    case "SERVICE_UNAVAILABLE":
      return "network"
    default:
      // Any other membership state (suspended, removed, …).
      return code.startsWith("MEMBERSHIP_") ? "accessEnded" : "unknown"
  }
}

/**
 * The text for a failed sign-in step. `ACCOUNT_LOCKED` says until when,
 * in the viewer's language and the school's time zone.
 */
export function authErrorMessage(
  t: Translate,
  error: { code: string; lockedUntil?: string },
  locale: string
): string {
  const key = authErrorKey(error.code)
  if (key === "accountLocked") {
    const time = formatDateTime(error.lockedUntil, dateOptionsFor(locale))
    return t(key, { time: time || "…" })
  }
  return t(key)
}
