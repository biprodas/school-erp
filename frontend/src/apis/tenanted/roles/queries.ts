"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "~/lib/api/client";
import { errorMessage, useTenantQueryEnabled } from "~/apis/tenanted/shared";
import type {
  CreateRolePayload,
  TenantRole,
  UpdateRolePayload,
} from "./types";

/** Co-located React Query keys for tenant roles. */
export const tenantRoleKeys = {
  all: ["tenant", "roles"] as const,
  list: () => [...tenantRoleKeys.all, "list"] as const,
};

// ---- Transport ----

// `GET /roles` returns a bare array (no `{ data }` envelope), which the axios
// interceptor passes through unchanged.
export const getRoles = () => api.get<TenantRole[]>("/roles");

export const createRole = (payload: CreateRolePayload) =>
  api.post<TenantRole>("/roles", payload);

export const updateRole = (id: string, payload: UpdateRolePayload) =>
  api.patch<TenantRole>(`/roles/${id}`, payload);

export const deleteRole = (id: string, force = false) =>
  api.delete<void>(`/roles/${id}${force ? "?force=true" : ""}`);

// ---- Hooks ----

export const useTenantRoles = (options?: { enabled?: boolean }) => {
  const tenantEnabled = useTenantQueryEnabled();
  return useQuery({
    queryKey: tenantRoleKeys.list(),
    queryFn: getRoles,
    enabled: tenantEnabled && (options?.enabled ?? true),
  });
};

export const useCreateRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRolePayload) => createRole(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tenantRoleKeys.all });
      toast.success("Role created");
    },
    onError: (e) => toast.error(errorMessage(e, "Failed to create role")),
  });
};

export const useUpdateRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateRolePayload }) =>
      updateRole(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tenantRoleKeys.all });
      toast.success("Role updated");
    },
    onError: (e) => toast.error(errorMessage(e, "Failed to update role")),
  });
};

export const useDeleteRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, force = false }: { id: string; force?: boolean }) =>
      deleteRole(id, force),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tenantRoleKeys.all });
      toast.success("Role deleted");
    },
    // Errors are handled by the caller: a 409 (role still assigned) escalates to
    // a force-delete prompt, anything else is toasted there.
  });
};
