"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "~/lib/api/client";
import { errorMessage, useTenantQueryEnabled } from "~/apis/tenanted/shared";
import type {
  CreateUserPayload,
  TenantUserRow,
  UpdateUserPayload,
} from "./types";

/** Co-located React Query keys for tenant users. */
export const tenantUserKeys = {
  all: ["tenant", "users"] as const,
  list: () => [...tenantUserKeys.all, "list"] as const,
  detail: (id: string) => [...tenantUserKeys.all, "detail", id] as const,
};

// ---- Transport ----

export const getUsers = () => api.get<TenantUserRow[]>("/users");

export const createUser = (payload: CreateUserPayload) =>
  api.post<TenantUserRow>("/users", payload);

export const updateUser = (id: string, payload: UpdateUserPayload) =>
  api.patch<TenantUserRow>(`/users/${id}`, payload);

export const deleteUser = (id: string) => api.delete<void>(`/users/${id}`);

export const grantAdmin = (id: string) =>
  api.post<TenantUserRow>(`/users/${id}/grant-admin`);

export const revokeAdmin = (id: string) =>
  api.post<TenantUserRow>(`/users/${id}/revoke-admin`);

export const assignRole = (userId: string, roleId: string) =>
  api.post<void>(`/users/${userId}/roles`, { roleId });

export const unassignRole = (userId: string, roleId: string) =>
  api.delete<void>(`/users/${userId}/roles/${roleId}`);

// ---- Hooks ----

export const useTenantUsers = (options?: { enabled?: boolean }) => {
  const tenantEnabled = useTenantQueryEnabled();
  return useQuery({
    queryKey: tenantUserKeys.list(),
    queryFn: getUsers,
    enabled: tenantEnabled && (options?.enabled ?? true),
  });
};

export const useCreateTenantUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tenantUserKeys.all });
      toast.success("User created");
    },
    onError: (e) => toast.error(errorMessage(e, "Failed to create user")),
  });
};

/**
 * Updates a user's name/status and reconciles their roles in one operation:
 * PATCHes the scalar fields, then assigns/unassigns roles via the dedicated
 * role endpoints (PATCH /users/:id does not accept roles).
 */
export const useUpdateTenantUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
      addRoleIds = [],
      removeRoleIds = [],
    }: {
      id: string;
      payload: UpdateUserPayload;
      addRoleIds?: string[];
      removeRoleIds?: string[];
    }) => {
      await updateUser(id, payload);
      for (const roleId of addRoleIds) await assignRole(id, roleId);
      for (const roleId of removeRoleIds) await unassignRole(id, roleId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tenantUserKeys.all });
      toast.success("User updated");
    },
    onError: (e) => toast.error(errorMessage(e, "Failed to update user")),
  });
};

export const useDeleteTenantUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tenantUserKeys.all });
      toast.success("User deleted");
    },
    onError: (e) => toast.error(errorMessage(e, "Failed to delete user")),
  });
};

export const useGrantAdmin = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => grantAdmin(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tenantUserKeys.all });
      toast.success("Admin access granted");
    },
    onError: (e) => toast.error(errorMessage(e, "Failed to grant admin")),
  });
};

export const useRevokeAdmin = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revokeAdmin(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tenantUserKeys.all });
      toast.success("Admin access revoked");
    },
    onError: (e) => toast.error(errorMessage(e, "Failed to revoke admin")),
  });
};
