import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { OnboardingWizard } from "~/features/onboarding/components/onboarding-wizard"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding")
  return { title: t("metaTitle") }
}

/** The setup wizard (M7): the checklist's steps, finish or skip. */
export default function OnboardingPage() {
  return <OnboardingWizard />
}
