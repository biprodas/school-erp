import { redirect } from "next/navigation";
import { auth } from "~/auth";
import {
  ONBOARDING_ACTIVATE,
  ONBOARDING_COMPLETE,
  ONBOARDING_SCHOOL,
  ONBOARDING_SIGNUP,
  PLATFORM_LOGIN_REDIRECT,
} from "~/constants/routes";
import { getOnboardingTenant } from "~/features/onboarding/resume";

/**
 * Resume resolver (apex). Maps an owner's onboarding `bootstrap_status` to the
 * next wizard step — all on the apex host (no subdomain hop).
 */
export default async function OnboardingContinuePage() {
  const session = await auth();
  if (session?.authKind !== "platform") {
    redirect(ONBOARDING_SIGNUP);
  }

  const tenant = await getOnboardingTenant();
  if (!tenant) {
    redirect(ONBOARDING_SCHOOL);
  }

  switch (tenant.bootstrapStatus) {
    case "owner_activated":
      redirect(ONBOARDING_COMPLETE);
      break;
    case "school_created":
    case "admin_invited":
      redirect(ONBOARDING_ACTIVATE);
      break;
    default:
      redirect(PLATFORM_LOGIN_REDIRECT);
  }
}
