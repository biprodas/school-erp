import "server-only"

import { isApiError } from "~/lib/api/errors"
import { backendFetch } from "~/lib/api/server"

/**
 * Checks an emailed link's token without using it (`GET /auth/activate`,
 * `/auth/reset-password`, `/auth/verify-email`). Null when the backend
 * refuses it (unknown, used or expired); other failures throw, so the
 * error page shows instead of "this link doesn't work".
 */
export async function checkToken<T>(
  path: string,
  token: string | null
): Promise<T | null> {
  if (!token) return null
  try {
    return await backendFetch<T>(path, { query: { token }, session: null })
  } catch (error) {
    if (isApiError(error) && error.status >= 400 && error.status < 500) {
      return null
    }
    throw error
  }
}
