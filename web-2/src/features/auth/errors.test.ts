import { describe, expect, it } from "vitest"

import bn from "../../../messages/bn.json"
import en from "../../../messages/en.json"

import {
  authErrorKey,
  authErrorMessage,
  queryErrorKey,
  type AuthErrorKey,
} from "./errors"

/** A stand-in for next-intl's translator over `authErrors`. */
const translator =
  (messages: Record<string, string>) =>
  (key: AuthErrorKey, values?: { time: string }) =>
    messages[key].replace("{time}", values?.time ?? "")

describe("authErrorKey", () => {
  it("maps the sign-in codes from doc/error-codes.md", () => {
    expect(authErrorKey("INVALID_CREDENTIALS")).toBe("invalidCredentials")
    expect(authErrorKey("ACCOUNT_LOCKED")).toBe("accountLocked")
    expect(authErrorKey("ACCOUNT_PENDING")).toBe("accountPending")
    expect(authErrorKey("ACCOUNT_SUSPENDED")).toBe("accountBlocked")
    expect(authErrorKey("MEMBERSHIP_PENDING")).toBe("membershipPending")
    expect(authErrorKey("MEMBERSHIP_SUSPENDED")).toBe("accessEnded")
    expect(authErrorKey("SESSION_REVOKED")).toBe("sessionEnded")
    expect(authErrorKey("PASSWORD_CHANGE_REQUIRED")).toBe(
      "passwordChangeRequired"
    )
    expect(authErrorKey("BAD_REQUEST")).toBe("linkInvalid")
    expect(authErrorKey("TOO_MANY_REQUESTS")).toBe("tooManyAttempts")
    expect(authErrorKey("NETWORK_ERROR")).toBe("network")
    expect(authErrorKey("SOMETHING_NEW")).toBe("unknown")
  })

  it("has a message in both languages for every key", () => {
    const keys: AuthErrorKey[] = [
      "invalidCredentials",
      "accountLocked",
      "unknown",
      "handoff",
      "googleNoAccount",
    ]
    for (const key of keys) {
      expect(en.authErrors[key]).toBeTruthy()
      expect(bn.authErrors[key]).toBeTruthy()
    }
  })
})

describe("queryErrorKey", () => {
  it("knows the handoff and Google errors, and nothing else", () => {
    expect(queryErrorKey("handoff")).toBe("handoff")
    expect(queryErrorKey("google_no_account")).toBe("googleNoAccount")
    expect(queryErrorKey("google_disabled")).toBe("googleDisabled")
    expect(queryErrorKey("<script>")).toBeNull()
    expect(queryErrorKey("constructor")).toBeNull()
    expect(queryErrorKey(null)).toBeNull()
  })
})

describe("authErrorMessage", () => {
  it("says until when an account is locked, in the school's time zone", () => {
    const message = authErrorMessage(
      translator(en.authErrors),
      { code: "ACCOUNT_LOCKED", lockedUntil: "2026-10-25T04:15:00.000Z" },
      "en"
    )
    expect(message).toBe(
      "Too many wrong passwords. You can try again after 25/10/2026 10:15 AM."
    )
  })

  it("uses Bangla digits in Bangla", () => {
    const message = authErrorMessage(
      translator(bn.authErrors),
      { code: "ACCOUNT_LOCKED", lockedUntil: "2026-10-25T04:15:00.000Z" },
      "bn"
    )
    expect(message).toContain("২৫/১০/২০২৬")
  })
})
