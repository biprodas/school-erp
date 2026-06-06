import { redirect } from "next/navigation";
import { auth } from "~/auth";
import { ONBOARDING_CONTINUE, ONBOARDING_SCHOOL } from "~/constants/routes";
import { PlatformSignupForm } from "~/features/platform/auth/signup/platform-signup-form";
import { OnboardingStepper } from "~/features/onboarding/onboarding-stepper";
import { getOnboardingTenant } from "~/features/onboarding/resume";

export default async function OnboardingSignupPage() {
  // Already signed in as a platform user? Resume at the right step: if they
  // already have a tenant mid-onboarding, hand off to the resume resolver;
  // otherwise send them to create their school.
  const session = await auth();
  if (session?.authKind === "platform") {
    const tenant = await getOnboardingTenant();
    redirect(tenant ? ONBOARDING_CONTINUE : ONBOARDING_SCHOOL);
  }

  return (
    <>
      <OnboardingStepper current="signup" />
      <PlatformSignupForm redirectTo={ONBOARDING_SCHOOL} />
    </>
  );
}
