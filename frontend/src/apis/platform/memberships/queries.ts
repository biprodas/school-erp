"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "~/lib/api/client";
import { errorMessage, usePlatformQueryEnabled } from "~/apis/platform/shared";
import type { OwnerActivation } from "~/apis/platform/organizations/types";
import type {
  CreateMembershipPayload,
  Membership,
  UpdateMembershipRolePayload,
} from "./types";

/** Membership create response: the membership plus an optional owner activation. */
export type CreateMembershipResult = Membership & {
  activation: OwnerActivation | null;
};

/** Co-located React Query keys for memberships. */
export const membershipKeys = {
  all: ["platform", "memberships"] as const,
  list: () => [...membershipKeys.all, "list"] as const,
};

// ---- Transport ----

export const getMemberships = () => api.get<Membership[]>("/memberships");

export const createMembership = (payload: CreateMembershipPayload) =>
  api.post<CreateMembershipResult>("/memberships", payload);

export const updateMembershipRole = (
  id: string,
  payload: UpdateMembershipRolePayload,
) => api.patch<Membership>(`/memberships/${id}`, payload);

export const deleteMembership = (id: string) =>
  api.delete<void>(`/memberships/${id}`);

// ---- Hooks ----

export const useMemberships = () => {
  const enabled = usePlatformQueryEnabled();
  return useQuery({
    queryKey: membershipKeys.list(),
    queryFn: getMemberships,
    enabled,
  });
}

export const useCreateMembership = () => {
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

export const useUpdateMembershipRole = () => {
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

export const useDeleteMembership = () => {
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
