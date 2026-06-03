import { API_BASE_URL, TENANT_HEADER } from "~/config";
import type { ApiResponse } from "~/types/api";

/**
 * Minimal server-side POST to the backend used by NextAuth `authorize` (and
 * other server flows) WITHOUT the session-aware axios interceptors — those
 * would create a circular dependency during sign-in. Unwraps the `{ data }`
 * envelope; throws `Error(message)` on a non-2xx response.
 */
export async function backendPost<T>(
  path: string,
  body: unknown,
  opts?: { tenantSlug?: string | null; accessToken?: string },
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts?.tenantSlug) headers[TENANT_HEADER] = opts.tenantSlug;
  if (opts?.accessToken) headers.Authorization = `Bearer ${opts.accessToken}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (!res.ok) {
    const message =
      (json as { message?: string } | null)?.message ??
      `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return json!.data;
}
