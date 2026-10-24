import "server-only"

import { serverEnv } from "~/lib/env"

import { unwrap } from "./envelope"
import { networkError } from "./errors"

const TIMEOUT_MS = 5_000

/**
 * Calls an unauthenticated backend endpoint (`/public/*`) from the server
 * and returns its `data`; throws `ApiError`. Signed-in calls go through
 * the session layer instead (M2).
 */
export async function fetchPublic<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = new URL(`/api${path}`, serverEnv().API_URL)
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: { accept: "application/json", ...init.headers },
      signal: init.signal ?? AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (cause) {
    throw networkError(cause)
  }
  const body: unknown = await response.json().catch(() => null)
  return unwrap<T>(response.status, body)
}
