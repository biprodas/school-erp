import type {
  PlatformTenant,
  TenantBootstrapStatus,
} from "~/apis/platform/tenants/types";
import {
  ONBOARDING_ACTIVATE,
  ONBOARDING_COMPLETE,
  ONBOARDING_SCHOOL,
  PLATFORM_LOGIN_REDIRECT,
} from "~/constants/routes";

/**
 * Derives the owner's onboarding bootstrap status from their tenant list.
 * `null` means no tenant yet (step 1 done, school not created).
 */
export function deriveBootstrapStatus(
  tenants: PlatformTenant[],
): TenantBootstrapStatus | null {
  if (!tenants.length) return null;
  const incomplete = tenants.find((t) => t.bootstrapStatus !== "completed");
  return incomplete?.bootstrapStatus ?? "completed";
}

/**
 * Maps a JWT-stored bootstrap status to the path the owner should be on.
 * Sync — safe for proxy and `authorized` callbacks.
 */
export function resolveOwnerDestinationFromBootstrap(
  status: TenantBootstrapStatus | null | undefined,
): string {
  if (status == null) return ONBOARDING_SCHOOL;
  if (status === "completed") return PLATFORM_LOGIN_REDIRECT;

  switch (status) {
    case "owner_activated":
      return ONBOARDING_COMPLETE;
    case "school_created":
    case "admin_invited":
      return ONBOARDING_ACTIVATE;
    default:
      return PLATFORM_LOGIN_REDIRECT;
  }
}

/** Tenant-list resolver — used when refreshing status from the API (e.g. login). */
export function resolveOwnerDestination(tenants: PlatformTenant[]): string {
  return resolveOwnerDestinationFromBootstrap(deriveBootstrapStatus(tenants));
}
