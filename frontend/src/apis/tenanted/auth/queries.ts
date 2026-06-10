"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { TENANT_HEADER } from "~/config/api-config";
import { api } from "~/lib/api/client";
import type {
  ActivationInfo,
  ActivatePayload,
  ActivateResult,
  ResetPasswordPayload,
  ResetTokenInfo,
  VerifyEmailResult,
} from "./types";

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

// ---- Password reset (tenant-scoped via the subdomain's x-tenant-id header) ----

export const requestPasswordReset = (email: string) =>
  api.post<unknown>("/auth/forgot-password", { email });

export const checkResetToken = (token: string) =>
  api.get<ResetTokenInfo>(
    `/auth/reset-password?token=${encodeURIComponent(token)}`,
  );

export const resetPassword = (payload: ResetPasswordPayload) =>
  api.post<unknown>("/auth/reset-password", payload);

// ---- Email verification ----

export const verifyEmail = (token: string) =>
  api.post<VerifyEmailResult>("/auth/verify-email", { token });

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

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (email: string) => requestPasswordReset(email),
  });
}

export function useCheckResetToken(token: string) {
  return useQuery({
    queryKey: ["tenant", "reset-token", token],
    queryFn: () => checkResetToken(token),
    enabled: Boolean(token),
    retry: false,
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (payload: ResetPasswordPayload) => resetPassword(payload),
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (token: string) => verifyEmail(token),
  });
}
