"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "~/lib/api/client";
import type { ResetPasswordPayload, ResetTokenInfo } from "./types";

// ---- Transport (platform surface; no tenant header needed) ----

export const requestPasswordReset = (email: string) =>
  api.post<unknown>("/platform/auth/forgot-password", { email });

export const checkResetToken = (token: string) =>
  api.get<ResetTokenInfo>(
    `/platform/auth/reset-password?token=${encodeURIComponent(token)}`,
  );

export const resetPassword = (payload: ResetPasswordPayload) =>
  api.post<unknown>("/platform/auth/reset-password", payload);

export const verifyEmail = (token: string) =>
  api.post<unknown>("/platform/auth/verify-email", { token });

export const resendVerification = (email: string) =>
  api.post<unknown>("/platform/auth/resend-verification", { email });

// ---- Hooks ----

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (email: string) => requestPasswordReset(email),
  });
}

export function useCheckResetToken(token: string) {
  return useQuery({
    queryKey: ["platform", "reset-token", token],
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

export function useResendVerification() {
  return useMutation({
    mutationFn: (email: string) => resendVerification(email),
  });
}
