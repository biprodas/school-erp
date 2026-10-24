import { serverEnv } from "~/lib/env"

import { networkError } from "./errors"

/** `/auth/me` → `http://localhost:3900/api/auth/me`. */
export function backendUrl(path: string, search = ""): URL {
  const url = new URL(
    `/api${path.startsWith("/") ? path : `/${path}`}`,
    serverEnv().API_URL
  )
  url.search = search
  return url
}

/**
 * A raw call to the backend from server code. Redirects are passed back
 * as they are (`redirect: "manual"`), so the BFF can hand an OAuth
 * redirect to the browser. Throws `ApiError` (`NETWORK_ERROR`) when the
 * backend can't be reached.
 */
export async function callBackend(
  url: URL,
  init: RequestInit & { duplex?: "half" }
): Promise<Response> {
  try {
    return await fetch(url, { redirect: "manual", cache: "no-store", ...init })
  } catch (cause) {
    throw networkError(cause)
  }
}

/** The JSON body of a backend response, or null when there is none. */
export async function readJson(response: Response): Promise<unknown> {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return null
  }
  return response.json().catch(() => null)
}
