"use client";

import { useSession } from "next-auth/react";
import type { TenantBootstrapStatus } from "~/apis/platform/tenants/types";

/** Persist onboarding progress in the JWT after a wizard step completes. */
export async function patchOnboardingBootstrapStatus(
  update: ReturnType<typeof useSession>["update"],
  status: TenantBootstrapStatus | null,
) {
  await update({ onboardingBootstrapStatus: status });
}

export function usePatchOnboardingBootstrapStatus() {
  const { update } = useSession();
  return (status: TenantBootstrapStatus | null) =>
    patchOnboardingBootstrapStatus(update, status);
}
