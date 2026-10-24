import { apiConfig } from "~/config/api-config";
import type { ApiResponse } from "~/types/api";

/** A non-2xx backend response: its HTTP status and the envelope's `code`. */
export class BackendError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "BackendError";
  }
}

/**
 * Minimal server-side POST to the backend used by NextAuth `authorize` (and
 * other server flows) WITHOUT the session-aware axios interceptors — those
 * would create a circular dependency during sign-in. Unwraps the `{ data }`
 * envelope; throws `BackendError` on a non-2xx response (and fetch's own
 * `TypeError` when the backend can't be reached).
 */
export async function backendPost<T>(
  path: string,
  body: unknown,
  opts?: { tenantSlug?: string | null; accessToken?: string },
): Promise<T> {
  return backendRequest<T>("POST", path, body, opts);
}

/** Minimal server-side GET to the backend (e.g. hydrate JWT on platform login). */
export async function backendGet<T>(
  path: string,
  opts?: { tenantSlug?: string | null; accessToken?: string },
): Promise<T> {
  return backendRequest<T>("GET", path, undefined, opts);
}

async function backendRequest<T>(
  method: "GET" | "POST",
  path: string,
  body: unknown,
  opts?: { tenantSlug?: string | null; accessToken?: string },
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts?.tenantSlug) headers[apiConfig.tenantHeader] = opts.tenantSlug;
  if (opts?.accessToken) headers.Authorization = `Bearer ${opts.accessToken}`;

  const res = await fetch(`${apiConfig.baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (!res.ok) {
    const error = json as { message?: string; code?: string } | null;
    throw new BackendError(
      error?.message ?? `Request failed with status ${res.status}`,
      res.status,
      error?.code,
    );
  }

  return json!.data;
}
