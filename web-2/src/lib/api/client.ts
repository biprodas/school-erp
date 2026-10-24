import { unwrap, unwrapPage, type Page } from "./envelope"
import { networkError } from "./errors"

/**
 * Header the BFF (`app/api/[...path]`) requires on mutating requests, as a
 * CSRF check: a cross-site form or image can't set a custom header.
 */
export const CSRF_HEADER = "x-requested-with"
export const CSRF_VALUE = "kampasy"

type QueryValue = string | number | boolean | null | undefined

export interface ApiRequest extends Omit<RequestInit, "body"> {
  /** Plain objects are sent as JSON; `FormData`, `Blob` and strings as is. */
  body?: unknown
  /** Query parameters; `null` and `undefined` values are left out. */
  query?: Record<string, QueryValue | QueryValue[]>
}

/** `/students` + `{ page: 2 }` → `/api/students?page=2`. */
export function apiUrl(path: string, query?: ApiRequest["query"]): string {
  const url = `/api${path.startsWith("/") ? path : `/${path}`}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== null && item !== undefined) params.append(key, String(item))
    }
  }
  const search = params.toString()
  return search ? `${url}?${search}` : url
}

const isRawBody = (body: unknown): body is BodyInit =>
  typeof body === "string" ||
  body instanceof FormData ||
  body instanceof Blob ||
  body instanceof URLSearchParams ||
  body instanceof ArrayBuffer

async function send(
  path: string,
  { body, query, headers, ...init }: ApiRequest
): Promise<{ status: number; body: unknown }> {
  const requestHeaders = new Headers(headers)
  requestHeaders.set(CSRF_HEADER, CSRF_VALUE)
  requestHeaders.set("accept", "application/json")

  let payload: BodyInit | undefined
  if (body !== undefined) {
    if (isRawBody(body)) {
      payload = body
    } else {
      payload = JSON.stringify(body)
      requestHeaders.set("content-type", "application/json")
    }
  }

  let response: Response
  try {
    response = await fetch(apiUrl(path, query), {
      ...init,
      headers: requestHeaders,
      body: payload,
      credentials: "same-origin",
    })
  } catch (cause) {
    throw networkError(cause)
  }

  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json")
  const parsed = isJson ? await response.json().catch(() => null) : null
  return { status: response.status, body: parsed }
}

/**
 * Calls the backend from the browser through the same-origin BFF and
 * returns the envelope's `data`. Throws `ApiError` on failure.
 */
export async function apiFetch<T>(
  path: string,
  init: ApiRequest = {}
): Promise<T> {
  const { status, body } = await send(path, init)
  return unwrap<T>(status, body)
}

/** Like `apiFetch`, for paginated lists: `{ items, meta }`. */
export async function apiFetchPage<T>(
  path: string,
  init: ApiRequest = {}
): Promise<Page<T>> {
  const { status, body } = await send(path, init)
  return unwrapPage<T>(status, body)
}
