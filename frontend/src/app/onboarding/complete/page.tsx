import { redirect } from "next/navigation";
import { auth } from "~/auth";
import {
  ONBOARDING_ACTIVATE,
  ONBOARDING_SIGNUP,
  PLATFORM_LOGIN_REDIRECT,
} from "~/constants/routes";
import { OnboardingComplete } from "~/features/onboarding/onboarding-complete";
import { OnboardingStepper } from "~/features/onboarding/onboarding-stepper";
import { getOnboardingTenant } from "~/features/onboarding/resume";

/**
 * Step 4 (apex): the completion screen. The owner is on their platform session;
 * finishing marks the tenant `completed` and sends them to the platform
 * dashboard.
 */
export default async function OnboardingCompletePage() {
  const session = await auth();
  if (session?.authKind !== "platform") {
    redirect(ONBOARDING_SIGNUP);
  }

  const tenant = await getOnboardingTenant();
  if (!tenant) {
    // Nothing pending — already finished.
    redirect(PLATFORM_LOGIN_REDIRECT);
  }
  if (tenant.bootstrapStatus !== "owner_activated") {
    // Password not set yet — go back to the access step.
    redirect(ONBOARDING_ACTIVATE);
  }

  return (
    <>
      <OnboardingStepper current="complete" />
      <OnboardingComplete tenantId={tenant.id} />
    </>
  );
}
