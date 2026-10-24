import { describe, expect, it } from "vitest"

import { unwrap, unwrapPage } from "./envelope"
import { ApiError, NETWORK_ERROR, networkError, toApiError } from "./errors"

const ok = (data: unknown, extra: object = {}) => ({
  success: true,
  statusCode: 200,
  message: "OK",
  data,
  ...extra,
})

describe("unwrap", () => {
  it("returns the envelope's data", () => {
    expect(unwrap(200, ok({ id: "u1" }))).toEqual({ id: "u1" })
    expect(unwrap(201, ok(null))).toBeNull()
  })

  it("returns raw bodies (no envelope) as they are", () => {
    expect(unwrap(200, { status: "ok" })).toEqual({ status: "ok" })
  })

  it("throws ApiError for error envelopes and non-2xx statuses", () => {
    const body = {
      success: false,
      statusCode: 401,
      message: "Too many failed sign-ins.",
      code: "ACCOUNT_LOCKED",
      lockedUntil: "2026-10-24T10:00:00.000Z",
      path: "/api/auth/login",
      timestamp: "2026-10-24T09:45:00.000Z",
      requestId: "req-1",
    }
    const error = (() => {
      try {
        unwrap(401, body)
      } catch (e) {
        return e
      }
    })()

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 401,
      code: "ACCOUNT_LOCKED",
      message: "Too many failed sign-ins.",
      requestId: "req-1",
      details: { lockedUntil: "2026-10-24T10:00:00.000Z" },
    })
    expect(() => unwrap(502, null)).toThrow(ApiError)
  })
})

describe("unwrapPage", () => {
  it("returns the items and the page info", () => {
    const meta = { page: 2, limit: 20, total: 41, totalPages: 3 }
    expect(unwrapPage(200, ok([{ id: 1 }], { meta }))).toEqual({
      items: [{ id: 1 }],
      meta,
    })
  })

  it("treats a list without meta as a single page", () => {
    expect(unwrapPage(200, ok([1, 2]))).toEqual({
      items: [1, 2],
      meta: { page: 1, limit: 2, total: 2, totalPages: 1 },
    })
  })
})

describe("toApiError", () => {
  it("keeps every validation message, the first as the message", () => {
    const error = toApiError(400, {
      success: false,
      statusCode: 400,
      message: ["password should not be empty", "identifier must be a string"],
      code: "VALIDATION_FAILED",
    })
    expect(error.message).toBe("password should not be empty")
    expect(error.messages).toHaveLength(2)
    expect(error.details).toEqual({})
  })

  it("falls back to an HTTP code when the body has none", () => {
    const error = toApiError(503, "<html>Bad gateway</html>")
    expect(error.code).toBe("HTTP_503")
    expect(error.message).toBe("Request failed")
  })

  it("marks network failures with status 0", () => {
    const cause = new TypeError("Failed to fetch")
    const error = networkError(cause)
    expect(error).toMatchObject({ status: 0, code: NETWORK_ERROR })
    expect(error.cause).toBe(cause)
  })
})
