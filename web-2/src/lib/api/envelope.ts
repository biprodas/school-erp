import { toApiError } from "./errors"

/** `meta` on paginated list responses (`?page=&limit=`). */
export interface PageMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface Page<T> {
  items: T[]
  meta: PageMeta
}

interface Envelope {
  success: boolean
  statusCode?: number
  message?: string | string[]
  data?: unknown
  meta?: PageMeta
}

const isEnvelope = (body: unknown): body is Envelope =>
  !!body && typeof body === "object" && "success" in body

/**
 * The `data` of a backend response. Errors (a `success: false` envelope or
 * any non-2xx status) throw `ApiError`. Handlers marked `@RawResponse()`
 * (health, HTML) have no envelope; their body is returned as is.
 */
export function unwrap<T>(status: number, body: unknown): T {
  const ok = status >= 200 && status < 300
  if (!ok || (isEnvelope(body) && body.success === false)) {
    throw toApiError(status, body)
  }
  return (isEnvelope(body) ? (body.data ?? null) : body) as T
}

/** A paginated list: `data` is the page's items, `meta` the page info. */
export function unwrapPage<T>(status: number, body: unknown): Page<T> {
  const items = unwrap<T[] | null>(status, body) ?? []
  const meta = isEnvelope(body) ? body.meta : undefined
  return {
    items,
    meta: meta ?? {
      page: 1,
      limit: items.length,
      total: items.length,
      totalPages: 1,
    },
  }
}
