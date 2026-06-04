"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "~/lib/api/client";
import { errorMessage, usePlatformQueryEnabled } from "~/apis/platform/shared";
import { membershipKeys } from "~/apis/platform/memberships/queries";
import type {
  CreateUserPayload,
  PlatformUserRow,
  UpdateUserPayload,
} from "./types";

/** Co-located React Query keys for platform users. */
export const platformUserKeys = {
  all: ["platform", "users"] as const,
  list: () => [...platformUserKeys.all, "list"] as const,
  detail: (id: string) => [...platformUserKeys.all, "detail", id] as const,
};

// ---- Transport ----

export const getUsers = () => api.get<PlatformUserRow[]>("/platform/users");

export const createUser = (payload: CreateUserPayload) =>
  api.post<PlatformUserRow>("/platform/users", payload);

export const updateUser = (id: string, payload: UpdateUserPayload) =>
  api.patch<PlatformUserRow>(`/platform/users/${id}`, payload);

export const deleteUser = (id: string) =>
  api.delete<void>(`/platform/users/${id}`);

// ---- Hooks ----

export const usePlatformUsers = (options?: { enabled?: boolean }) => {
  const platformEnabled = usePlatformQueryEnabled();
  return useQuery({
    queryKey: platformUserKeys.list(),
    queryFn: getUsers,
    enabled: platformEnabled && (options?.enabled ?? true),
  });
}

export const useCreateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: platformUserKeys.all });
      toast.success("User created");
    },
    onError: (e) => toast.error(errorMessage(e, "Failed to create user")),
  });
}

export const useUpdateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPayload }) =>
      updateUser(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: platformUserKeys.all });
      toast.success("User updated");
    },
    onError: (e) => toast.error(errorMessage(e, "Failed to update user")),
  });
}

export const useDeleteUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: platformUserKeys.all });
      void qc.invalidateQueries({ queryKey: membershipKeys.all });
      toast.success("User deleted");
    },
    onError: (e) => toast.error(errorMessage(e, "Failed to delete user")),
  });
}
