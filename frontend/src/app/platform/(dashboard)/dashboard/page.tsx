import { redirect } from "next/navigation";
import PlatformDashboardView from "~/features/platform/dashboard";
import { auth } from "~/auth";
import { serverApi } from "~/lib/api/server";
import { ONBOARDING_SCHOOL } from "~/constants/routes";
import type { PlatformTenant } from "~/apis/platform/tenants/types";

export default async function PlatformDashboardPage() {
  // A non-admin platform user with no schools yet is sent into the onboarding
  // wizard's create-school step (resumes self-registration where they left off).
  const session = await auth();
  if (session?.authKind === "platform" && session.user?.isAdmin === false) {
    let tenantCount = 0;
    try {
      const tenants = await serverApi.get<PlatformTenant[]>("/tenants");
      tenantCount = tenants?.length ?? 0;
    } catch {
      // On a lookup failure, fall through and render the dashboard.
    }
    if (tenantCount === 0) {
      redirect(ONBOARDING_SCHOOL);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform</h1>
        <p className="text-sm text-muted-foreground">
          Manage tenants, users, and platform settings
        </p>
      </div>
      <PlatformDashboardView />
    </div>
  );
}
