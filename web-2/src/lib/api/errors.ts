/** Fields every backend error carries; they are not repeated in `details`. */
const ENVELOPE_KEYS = new Set([
  "success",
  "statusCode",
  "message",
  "code",
  "path",
  "timestamp",
  "requestId",
  "error",
])

/** `code` for failures that never reached the backend. */
export const NETWORK_ERROR = "NETWORK_ERROR"

/**
 * `code` the BFF answers with (401) when the session can't be renewed:
 * the user has to sign in again. The backend never sends it.
 */
export const SESSION_EXPIRED = "SESSION_EXPIRED"

/**
 * `code` of the backend's 403 for an account with a temporary password:
 * only changing it (and signing out) is allowed.
 */
export const PASSWORD_CHANGE_REQUIRED = "PASSWORD_CHANGE_REQUIRED"

/**
 * A failed API call. `code` is the backend's machine-readable code (see
 * `doc/error-codes.md`), which the UI maps to Bangla or English text;
 * `message` is the backend's English fallback. Extra fields the backend
 * sends with some errors (`lockedUntil`, `problems`, …) are in `details`.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  /** Every message; validation errors (400) usually have several. */
  readonly messages: string[]
  readonly details: Record<string, unknown>
  readonly requestId?: string

  constructor(init: {
    status: number
    code: string
    messages: string[]
    details?: Record<string, unknown>
    requestId?: string
  }) {
    super(init.messages[0] ?? "Request failed")
    this.name = "ApiError"
    this.status = init.status
    this.code = init.code
    this.messages = init.messages
    this.details = init.details ?? {}
    this.requestId = init.requestId
  }
}

export const isApiError = (error: unknown): error is ApiError =>
  error instanceof ApiError

/** Builds an `ApiError` from a backend error body, or anything else. */
export function toApiError(status: number, body: unknown): ApiError {
  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const raw = record.message
  const messages = (Array.isArray(raw) ? raw : [raw]).filter(
    (m): m is string => typeof m === "string" && m.length > 0
  )
  const details = Object.fromEntries(
    Object.entries(record).filter(([key]) => !ENVELOPE_KEYS.has(key))
  )
  return new ApiError({
    status,
    code: typeof record.code === "string" ? record.code : `HTTP_${status}`,
    messages: messages.length ? messages : ["Request failed"],
    details,
    requestId:
      typeof record.requestId === "string" ? record.requestId : undefined,
  })
}

/** A request that failed before any response (offline, DNS, CORS, abort). */
export function networkError(cause: unknown): ApiError {
  const error = new ApiError({
    status: 0,
    code: NETWORK_ERROR,
    messages: ["Could not reach the server"],
  })
  error.cause = cause
  return error
}
