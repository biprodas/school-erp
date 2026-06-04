"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "~/lib/api/client";
import type { ActivationInfo, ActivatePayload } from "./types";

// ---- Transport (tenant-scoped via the subdomain's x-tenant-id header) ----

export const verifyActivation = (token: string) =>
  api.get<ActivationInfo>(
    `/auth/activate?token=${encodeURIComponent(token)}`,
  );

export const activateAccount = (payload: ActivatePayload) =>
  api.post<unknown>("/auth/activate", payload);

// ---- Hooks ----

export function useVerifyActivation(token: string) {
  return useQuery({
    queryKey: ["tenant", "activation", token],
    queryFn: () => verifyActivation(token),
    enabled: Boolean(token),
    retry: false,
  });
}

export function useActivateAccount() {
  return useMutation({
    mutationFn: (payload: ActivatePayload) => activateAccount(payload),
  });
}
