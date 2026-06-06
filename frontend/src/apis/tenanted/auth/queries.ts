"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { TENANT_HEADER } from "~/config";
import { api } from "~/lib/api/client";
import type { ActivationInfo, ActivatePayload, ActivateResult } from "./types";

// ---- Transport (tenant-scoped via the subdomain's x-tenant-id header) ----

export const verifyActivation = (token: string) =>
  api.get<ActivationInfo>(
    `/auth/activate?token=${encodeURIComponent(token)}`,
  );

/**
 * Activate (set password). On the tenant subdomain the slug is implicit; from
 * the apex wizard pass `tenantSlug` so the tenant is resolved via an explicit
 * `x-tenant-id` header (the axios client won't clobber it).
 */
export const activateAccount = (payload: ActivatePayload, tenantSlug?: string) =>
  api.post<ActivateResult>(
    "/auth/activate",
    payload,
    tenantSlug ? { headers: { [TENANT_HEADER]: tenantSlug } } : undefined,
  );

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
