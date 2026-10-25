import { isApiError } from "~/lib/api/errors"

import type messages from "../../../messages/en.json"

/** A field message: a key under `validation` in the message catalogs. */
export type FieldMessage = keyof (typeof messages)["validation"]

/**
 * What a form's server action answers when it doesn't redirect. Errors
 * carry the backend's code (`doc/error-codes.md`), which the form turns
 * into Bangla or English text.
 */
export type FormState =
  | { status: "idle" }
  | { status: "success"; email?: string | null }
  | {
      status: "error"
      code: string
      /** Messages for single fields, shown under them. */
      fieldErrors?: Partial<Record<string, FieldMessage>>
      /** `lockedUntil` (ISO) for `ACCOUNT_LOCKED`. */
      lockedUntil?: string
      /** Free alternatives for `SLUG_TAKEN` / `SLUG_RESERVED`. */
      suggestions?: string[]
    }

export const IDLE: FormState = { status: "idle" }

/** The failure of a backend call, as form state. */
export function errorState(error: unknown): FormState {
  if (!isApiError(error)) {
    console.error("[form] unexpected failure", error)
    return { status: "error", code: "UNKNOWN" }
  }
  const { lockedUntil, suggestions } = error.details
  return {
    status: "error",
    code: error.code,
    ...(typeof lockedUntil === "string" && { lockedUntil }),
    ...(Array.isArray(suggestions) && {
      suggestions: suggestions.filter((s) => typeof s === "string"),
    }),
  }
}

/** Field errors from a failed zod parse on the server (no JS, or tampering). */
export function invalidState(issues: {
  issues: { path: PropertyKey[]; message: string }[]
}): FormState {
  const fieldErrors: Partial<Record<string, FieldMessage>> = {}
  for (const issue of issues.issues) {
    const field = String(issue.path[0] ?? "")
    fieldErrors[field] ??= issue.message as FieldMessage
  }
  return { status: "error", code: "VALIDATION_FAILED", fieldErrors }
}
