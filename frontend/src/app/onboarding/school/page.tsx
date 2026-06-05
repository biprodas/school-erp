import { redirect } from "next/navigation";
import { auth } from "~/auth";
import { ONBOARDING_SIGNUP } from "~/constants/routes";
import { CreateSchoolStep } from "~/features/onboarding/create-school-step";
import { OnboardingStepper } from "~/features/onboarding/onboarding-stepper";

export default async function OnboardingSchoolPage() {
  // Creating a school requires a signed-in platform account (Step 1).
  const session = await auth();
  if (session?.authKind !== "platform") {
    redirect(ONBOARDING_SIGNUP);
  }

  return (
    <>
      <OnboardingStepper current="school" />
      <CreateSchoolStep />
    </>
  );
}
