import type { PlatformTenant } from "~/apis/platform/tenants/types";
import { serverApi } from "~/lib/api/server";

/**
 * The signed-in platform owner's tenant that is still mid-onboarding, if any.
 * Used by the apex wizard pages to decide whether to resume an owner instead of
 * showing the create-school form (which would create a second tenant).
 *
 * Non-admin owners get only their own tenants from `GET /tenants`. We pick the
 * first one that hasn't finished onboarding; a fully onboarded owner returns
 * `null` (nothing to resume).
 */
export async function getOnboardingTenant(): Promise<PlatformTenant | null> {
  try {
    const tenants = await serverApi.get<PlatformTenant[]>("/tenants");
    if (!Array.isArray(tenants) || tenants.length === 0) return null;
    return tenants.find((t) => t.bootstrapStatus !== "completed") ?? null;
  } catch {
    return null;
  }
}
