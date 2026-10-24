import { afterEach, describe, expect, it, vi } from "vitest"

import {
  apiFetch,
  apiFetchPage,
  apiUrl,
  CSRF_HEADER,
  CSRF_VALUE,
} from "./client"
import { ApiError, NETWORK_ERROR } from "./errors"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

function mockFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error
      ? Promise.reject(response)
      : Promise.resolve(response)
  )
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

const lastCall = (fetchMock: ReturnType<typeof mockFetch>) => {
  const [url, init] = fetchMock.mock.calls.at(-1) as unknown as [
    string,
    RequestInit,
  ]
  return { url, init, headers: new Headers(init.headers) }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("apiUrl", () => {
  it("prefixes /api and drops empty query values", () => {
    expect(apiUrl("/students")).toBe("/api/students")
    expect(apiUrl("students", { page: 2, q: "rafi", status: undefined })).toBe(
      "/api/students?page=2&q=rafi"
    )
    expect(apiUrl("/students", { ids: ["a", "b"], x: null })).toBe(
      "/api/students?ids=a&ids=b"
    )
  })
})

describe("apiFetch", () => {
  it("sends JSON with the CSRF header and returns the data", async () => {
    const fetchMock = mockFetch(json({ success: true, data: { ok: 1 } }))

    await expect(
      apiFetch("/auth/login", { method: "POST", body: { identifier: "a" } })
    ).resolves.toEqual({ ok: 1 })

    const { url, init, headers } = lastCall(fetchMock)
    expect(url).toBe("/api/auth/login")
    expect(init.body).toBe('{"identifier":"a"}')
    expect(init.credentials).toBe("same-origin")
    expect(headers.get(CSRF_HEADER)).toBe(CSRF_VALUE)
    expect(headers.get("content-type")).toBe("application/json")
  })

  it("passes FormData through without a JSON content type", async () => {
    const fetchMock = mockFetch(json({ success: true, data: null }, 201))
    const form = new FormData()
    form.append("file", new Blob(["x"]), "x.txt")

    await apiFetch("/settings/files/logo", { method: "POST", body: form })

    const { init, headers } = lastCall(fetchMock)
    expect(init.body).toBe(form)
    expect(headers.has("content-type")).toBe(false)
  })

  it("throws the backend error as ApiError", async () => {
    mockFetch(
      json(
        {
          success: false,
          statusCode: 401,
          message: "Invalid credentials",
          code: "INVALID_CREDENTIALS",
        },
        401
      )
    )

    await expect(
      apiFetch("/auth/login", { method: "POST" })
    ).rejects.toMatchObject({
      status: 401,
      code: "INVALID_CREDENTIALS",
    })
  })

  it("turns a failed request into a network ApiError", async () => {
    mockFetch(new TypeError("Failed to fetch"))

    const error = await apiFetch("/auth/me").catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 0, code: NETWORK_ERROR })
  })

  it("throws for a non-JSON error page", async () => {
    mockFetch(new Response("<html>502</html>", { status: 502 }))

    await expect(apiFetch("/auth/me")).rejects.toMatchObject({
      code: "HTTP_502",
    })
  })
})

describe("apiFetchPage", () => {
  it("returns items and meta", async () => {
    const meta = { page: 1, limit: 20, total: 1, totalPages: 1 }
    mockFetch(json({ success: true, data: [{ id: "s1" }], meta }))

    await expect(apiFetchPage("/students")).resolves.toEqual({
      items: [{ id: "s1" }],
      meta,
    })
  })
})
