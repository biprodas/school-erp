import { redirect } from "next/navigation";
import { auth } from "~/auth";
import { ONBOARDING_CONTINUE, ONBOARDING_SIGNUP } from "~/constants/routes";
import { CreateSchoolStep } from "~/features/onboarding/create-school-step";
import { OnboardingStepper } from "~/features/onboarding/onboarding-stepper";
import { getOnboardingTenant } from "~/features/onboarding/resume";

export default async function OnboardingSchoolPage() {
  // Creating a school requires a signed-in platform account (Step 1).
  const session = await auth();
  if (session?.authKind !== "platform") {
    redirect(ONBOARDING_SIGNUP);
  }

  // Already created a school? Resume the next step instead of creating another.
  const tenant = await getOnboardingTenant();
  if (tenant) {
    redirect(ONBOARDING_CONTINUE);
  }

  return (
    <>
      <OnboardingStepper current="school" />
      <CreateSchoolStep />
    </>
  );
}
