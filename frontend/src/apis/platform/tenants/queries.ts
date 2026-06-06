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
  CreateTenantPayload,
  CreateTenantResult,
  OwnerActivation,
  PlatformTenant,
  TransferOwnershipPayload,
  UpdateTenantPayload,
} from "./types";

/** Co-located React Query keys for tenants. */
export const tenantKeys = {
  all: ["platform", "tenants"] as const,
  list: () => [...tenantKeys.all, "list"] as const,
  detail: (id: string) => [...tenantKeys.all, "detail", id] as const,
};

// ---- Transport (over the session-aware browser client) ----

export const getTenants = () => api.get<PlatformTenant[]>("/tenants");

export const createTenant = (payload: CreateTenantPayload) =>
  api.post<CreateTenantResult>("/tenants", payload);

export const reissueOwnerActivation = (id: string) =>
  api.post<OwnerActivation>(`/tenants/${id}/owner/activation-link`);

/** Owner-or-admin: mint a fresh activation link to resume onboarding (step 3). */
export const resumeOwnerActivation = (id: string) =>
  api.post<{ activation: OwnerActivation }>(
    `/tenants/${id}/resume-activation`,
  );

/** Owner-or-admin: mark onboarding finished (step 4) from the platform session. */
export const completeOnboarding = (id: string) =>
  api.post<{ bootstrapStatus: PlatformTenant["bootstrapStatus"] }>(
    `/tenants/${id}/complete-onboarding`,
  );

export const updateTenant = (id: string, payload: UpdateTenantPayload) =>
  api.patch<PlatformTenant>(`/tenants/${id}`, payload);

export const transferOwnership = (
  id: string,
  payload: TransferOwnershipPayload,
) =>
  api.post<{ activation: OwnerActivation | null }>(
    `/tenants/${id}/transfer-ownership`,
    payload,
  );

export const deleteTenant = (id: string) => api.delete<void>(`/tenants/${id}`);

// ---- Hooks ----

export const useTenants = () => {
  const enabled = usePlatformQueryEnabled();
  return useQuery({
    queryKey: tenantKeys.list(),
    queryFn: getTenants,
    enabled,
  });
}

export const useCreateTenant = () => {
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

export const useUpdateTenant = () => {
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

export const useTransferOwnership = () => {
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
    onError: (e) => toast.error(errorMessage(e, "Failed to transfer ownership")),
  });
}

export const useDeleteTenant = () => {
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

export const useReissueOwnerActivation = () => {
  return useMutation({
    mutationFn: (id: string) => reissueOwnerActivation(id),
    onError: (e) =>
      toast.error(errorMessage(e, "Failed to issue activation link")),
  });
}

export const useCompleteOnboarding = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => completeOnboarding(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tenantKeys.all });
    },
  });
}

