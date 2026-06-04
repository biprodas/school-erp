"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  membershipKeys,
  platformUserKeys,
  tenantKeys,
} from "~/lib/api/query-keys";
import { ApiError } from "~/types/api";
import type {
  CreateMembershipPayload,
  CreateTenantPayload,
  CreateUserPayload,
  TransferOwnershipPayload,
  UpdateMembershipRolePayload,
  UpdateTenantPayload,
  UpdateUserPayload,
} from "~/types/platform";
import {
  createMembership,
  createTenant,
  createUser,
  deleteMembership,
  deleteTenant,
  deleteUser,
  getMemberships,
  getTenants,
  getUsers,
  transferOwnership,
  updateMembershipRole,
  updateTenant,
  updateUser,
} from "./api";

/** Pull a human-readable message off an ApiError (or any error). */
function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

/** True once the session is an authenticated platform session. */
function usePlatformEnabled() {
  const { data: session, status } = useSession();
  return status === "authenticated" && session?.authKind === "platform";
}

// ---- Queries ----

export function useTenants() {
  const enabled = usePlatformEnabled();
  return useQuery({
    queryKey: tenantKeys.list(),
    queryFn: getTenants,
    enabled,
  });
}

export function usePlatformUsers(options?: { enabled?: boolean }) {
  const platformEnabled = usePlatformEnabled();
  return useQuery({
    queryKey: platformUserKeys.list(),
    queryFn: getUsers,
    enabled: platformEnabled && (options?.enabled ?? true),
  });
}

export function useMemberships() {
  const enabled = usePlatformEnabled();
  return useQuery({
    queryKey: membershipKeys.list(),
    queryFn: getMemberships,
    enabled,
  });
}

// ---- Tenant mutations ----

export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTenantPayload) => createTenant(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tenantKeys.all });
      void qc.invalidateQueries({ queryKey: membershipKeys.all });
      toast.success("Tenant created");
    },
    onError: (e) => toast.error(errorMessage(e, "Failed to create tenant")),
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateTenantPayload }) =>
      updateTenant(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tenantKeys.all });
      toast.success("Tenant updated");
    },
    onError: (e) => toast.error(errorMessage(e, "Failed to update tenant")),
  });
}

export function useTransferOwnership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: TransferOwnershipPayload;
    }) => transferOwnership(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tenantKeys.all });
      void qc.invalidateQueries({ queryKey: membershipKeys.all });
      toast.success("Ownership transferred");
    },
    onError: (e) =>
      toast.error(errorMessage(e, "Failed to transfer ownership")),
  });
}

export function useDeleteTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTenant(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tenantKeys.all });
      void qc.invalidateQueries({ queryKey: membershipKeys.all });
      toast.success("Tenant deleted");
    },
    onError: (e) => toast.error(errorMessage(e, "Failed to delete tenant")),
  });
}

// ---- User mutations ----

export function useCreateUser() {
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

export function useUpdateUser() {
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

export function useDeleteUser() {
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

// ---- Membership mutations ----

export function useCreateMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateMembershipPayload) => createMembership(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: membershipKeys.all });
      toast.success("Membership created");
    },
    onError: (e) => toast.error(errorMessage(e, "Failed to create membership")),
  });
}

export function useUpdateMembershipRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateMembershipRolePayload;
    }) => updateMembershipRole(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: membershipKeys.all });
      toast.success("Membership role updated");
    },
    onError: (e) => toast.error(errorMessage(e, "Failed to update membership")),
  });
}

export function useDeleteMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMembership(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: membershipKeys.all });
      toast.success("Membership removed");
    },
    onError: (e) => toast.error(errorMessage(e, "Failed to remove membership")),
  });
}
