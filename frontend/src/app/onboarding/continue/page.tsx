import { redirect } from "next/navigation";
import { auth } from "~/auth";
import { ONBOARDING_SIGNUP } from "~/constants/routes";
import { resolveOwnerDestinationForSession } from "~/features/onboarding/resolve-session-destination";

/**
 * Resume resolver (apex). Reads onboarding progress from the JWT and redirects
 * to the correct wizard step — no API round-trip.
 */
export default async function OnboardingContinuePage() {
  const session = await auth();
  if (session?.authKind !== "platform") {
    redirect(ONBOARDING_SIGNUP);
  }

  redirect(await resolveOwnerDestinationForSession(session));
}
