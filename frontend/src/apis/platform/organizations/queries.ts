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
  CreateOrganizationPayload,
  CreateOrganizationResult,
  OwnerActivation,
  PlatformOrganization,
  TransferOwnershipPayload,
  UpdateOrganizationPayload,
} from "./types";

/** Co-located React Query keys for tenants. */
export const organizationKeys = {
  all: ["platform", "organizations"] as const,
  list: () => [...organizationKeys.all, "list"] as const,
  detail: (id: string) => [...organizationKeys.all, "detail", id] as const,
};

// ---- Transport (over the session-aware browser client) ----

export const getOrganizations = () => api.get<PlatformOrganization[]>("/organizations");

export const createOrganization = (payload: CreateOrganizationPayload) =>
  api.post<CreateOrganizationResult>("/organizations", payload);

/** Owner-or-admin: mint a fresh one-time owner activation link. */
export const reissueOwnerActivation = (id: string) =>
  api.post<OwnerActivation>(`/organizations/${id}/owner/activation-link`);

export const updateOrganization = (id: string, payload: UpdateOrganizationPayload) =>
  api.patch<PlatformOrganization>(`/organizations/${id}`, payload);

export const transferOwnership = (
  id: string,
  payload: TransferOwnershipPayload,
) =>
  api.post<{ activation: OwnerActivation | null }>(
    `/organizations/${id}/transfer-ownership`,
    payload,
  );

export const deleteOrganization = (id: string) => api.delete<void>(`/organizations/${id}`);

// ---- Hooks ----

export const useOrganizations = () => {
  const enabled = usePlatformQueryEnabled();
  return useQuery({
    queryKey: organizationKeys.list(),
    queryFn: getOrganizations,
    enabled,
  });
}

export const useCreateOrganization = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrganizationPayload) => createOrganization(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: organizationKeys.all });
      void qc.invalidateQueries({ queryKey: membershipKeys.all });
      toast.success("Organization created");
    },
    onError: (e) => toast.error(errorMessage(e, "Failed to create organization")),
  });
}

export const useUpdateOrganization = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateOrganizationPayload }) =>
      updateOrganization(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: organizationKeys.all });
      toast.success("Organization updated");
    },
    onError: (e) => toast.error(errorMessage(e, "Failed to update organization")),
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
      void qc.invalidateQueries({ queryKey: organizationKeys.all });
      void qc.invalidateQueries({ queryKey: membershipKeys.all });
      toast.success("Ownership transferred");
    },
    onError: (e) => toast.error(errorMessage(e, "Failed to transfer ownership")),
  });
}

export const useDeleteOrganization = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteOrganization(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: organizationKeys.all });
      void qc.invalidateQueries({ queryKey: membershipKeys.all });
      toast.success("Organization deleted");
    },
    onError: (e) => toast.error(errorMessage(e, "Failed to delete organization")),
  });
}

export const useReissueOwnerActivation = () => {
  return useMutation({
    mutationFn: (id: string) => reissueOwnerActivation(id),
    onError: (e) =>
      toast.error(errorMessage(e, "Failed to issue activation link")),
  });
}

