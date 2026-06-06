import { redirect } from "next/navigation";
import { auth } from "~/auth";
import {
  ONBOARDING_COMPLETE,
  ONBOARDING_SCHOOL,
  ONBOARDING_SIGNUP,
} from "~/constants/routes";
import { OnboardingStepper } from "~/features/onboarding/onboarding-stepper";
import { getOnboardingTenant } from "~/features/onboarding/resume";
import { SetupAccessStep } from "~/features/onboarding/setup-access-step";

/**
 * Step 3 (apex): "Set up access". Requires the platform session from signup and
 * a tenant still mid-onboarding. Stays on the apex host — the tenant is resolved
 * from its slug via an explicit header, no subdomain redirect.
 */
export default async function OnboardingActivatePage() {
  const session = await auth();
  if (session?.authKind !== "platform") {
    redirect(ONBOARDING_SIGNUP);
  }

  const tenant = await getOnboardingTenant();
  if (!tenant) {
    // No school yet (or already fully onboarded) — start at create-school.
    redirect(ONBOARDING_SCHOOL);
  }
  if (tenant.bootstrapStatus === "owner_activated") {
    redirect(ONBOARDING_COMPLETE);
  }

  return (
    <>
      <OnboardingStepper current="setup" />
      <SetupAccessStep tenantId={tenant.id} tenantSlug={tenant.slug} />
    </>
  );
}
