import { api } from "~/lib/api/client";
import type {
  CreateMembershipPayload,
  CreateTenantPayload,
  CreateUserPayload,
  Membership,
  PlatformTenant,
  PlatformUserRow,
  TransferOwnershipPayload,
  UpdateMembershipRolePayload,
  UpdateTenantPayload,
  UpdateUserPayload,
} from "~/types/platform";

/**
 * Thin API functions over the platform management endpoints. The shared
 * browser client (`api`) already injects the platform bearer token and unwraps
 * the `{ data }` envelope.
 */

// ---- Tenants (/tenants) ----

export const getTenants = () => api.get<PlatformTenant[]>("/tenants");

export const createTenant = (payload: CreateTenantPayload) =>
  api.post<PlatformTenant>("/tenants", payload);

export const updateTenant = (id: string, payload: UpdateTenantPayload) =>
  api.patch<PlatformTenant>(`/tenants/${id}`, payload);

export const transferOwnership = (
  id: string,
  payload: TransferOwnershipPayload,
) => api.post<Membership>(`/tenants/${id}/transfer-ownership`, payload);

export const deleteTenant = (id: string) =>
  api.delete<void>(`/tenants/${id}`);

// ---- Platform users (/platform/users) ----

export const getUsers = () => api.get<PlatformUserRow[]>("/platform/users");

export const createUser = (payload: CreateUserPayload) =>
  api.post<PlatformUserRow>("/platform/users", payload);

export const updateUser = (id: string, payload: UpdateUserPayload) =>
  api.patch<PlatformUserRow>(`/platform/users/${id}`, payload);

export const deleteUser = (id: string) =>
  api.delete<void>(`/platform/users/${id}`);

// ---- Memberships (/memberships) ----

export const getMemberships = () => api.get<Membership[]>("/memberships");

export const createMembership = (payload: CreateMembershipPayload) =>
  api.post<Membership>("/memberships", payload);

export const updateMembershipRole = (
  id: string,
  payload: UpdateMembershipRolePayload,
) => api.patch<Membership>(`/memberships/${id}`, payload);

export const deleteMembership = (id: string) =>
  api.delete<void>(`/memberships/${id}`);
