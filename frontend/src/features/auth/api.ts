import { AUTH_ENDPOINTS, TENANT_HEADER } from "~/config";
import { api } from "~/lib/api/client";
import type { RegisterPayload } from "~/types/api";
import type { AuthKind } from "~/types/user";

/**
 * Register a new user against the tenant or platform auth surface. For tenant
 * registration off a subdomain, pass `tenantSlug` so the `x-tenant-id` header
 * is set explicitly (the interceptor can't infer it without a subdomain).
 */
export function registerUser(
  authKind: AuthKind,
  payload: RegisterPayload,
  tenantSlug?: string,
) {
  const endpoint =
    authKind === "platform"
      ? AUTH_ENDPOINTS.platform.register
      : AUTH_ENDPOINTS.tenant.register;
  const config =
    authKind === "tenant" && tenantSlug
      ? { headers: { [TENANT_HEADER]: tenantSlug } }
      : undefined;
  return api.post<unknown>(endpoint, payload, config);
}

/** Fetch the current authenticated user from the matching `/me` endpoint. */
export function fetchMe<T>(authKind: AuthKind) {
  const endpoint =
    authKind === "platform"
      ? AUTH_ENDPOINTS.platform.me
      : AUTH_ENDPOINTS.tenant.me;
  return api.get<T>(endpoint);
}
