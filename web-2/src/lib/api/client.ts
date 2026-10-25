import { unwrap, unwrapPage, type Page } from "./envelope"
import {
  networkError,
  PASSWORD_CHANGE_REQUIRED,
  SESSION_EXPIRED,
} from "./errors"

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

/** `{ page: 2, q: undefined, ids: ["a", "b"] }` → `page=2&ids=a&ids=b`. */
export function toSearch(query: ApiRequest["query"] = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== null && item !== undefined) params.append(key, String(item))
    }
  }
  return params.toString()
}

/** `/students` + `{ page: 2 }` → `/api/students?page=2`. */
export function apiUrl(path: string, query?: ApiRequest["query"]): string {
  const url = `/api${path.startsWith("/") ? path : `/${path}`}`
  const search = toSearch(query)
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
  const code = (parsed as { code?: unknown } | null)?.code
  if (response.status === 401 && code === SESSION_EXPIRED) signInAgain()
  if (response.status === 403 && code === PASSWORD_CHANGE_REQUIRED) {
    changePasswordFirst()
  }
  return { status: response.status, body: parsed }
}

/**
 * The BFF ended the session (refresh token expired or revoked): go to the
 * sign-in page and come back here afterwards. The call still rejects.
 */
function signInAgain() {
  if (typeof window === "undefined") return
  const { pathname, search } = window.location
  if (pathname === "/login") return
  // A full page load on purpose: it drops the ended session's cached data,
  // and this module runs outside React, where there is no router.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(
    `/login?next=${encodeURIComponent(`${pathname}${search}`)}`
  )
}

/**
 * The account has a temporary password (set by an admin after this page
 * loaded): nothing else opens until it is changed. The call still rejects.
 */
function changePasswordFirst() {
  if (typeof window === "undefined") return
  if (window.location.pathname === "/change-password") return
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/change-password")
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
