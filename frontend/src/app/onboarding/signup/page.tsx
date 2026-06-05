import { redirect } from "next/navigation";
import { auth } from "~/auth";
import { ONBOARDING_SCHOOL } from "~/constants/routes";
import { PlatformSignupForm } from "~/features/platform/auth/signup/platform-signup-form";
import { OnboardingStepper } from "~/features/onboarding/onboarding-stepper";

export default async function OnboardingSignupPage() {
  // Already signed in as a platform user? Skip ahead to creating a school.
  const session = await auth();
  if (session?.authKind === "platform") {
    redirect(ONBOARDING_SCHOOL);
  }

  return (
    <>
      <OnboardingStepper current="signup" />
      <PlatformSignupForm redirectTo={ONBOARDING_SCHOOL} />
    </>
  );
}
