import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query"
import { redirect } from "next/navigation"
import { getLocale } from "next-intl/server"

import { authKeys, type Me } from "~/features/auth/api"
import {
  onboardingKeys,
  type OnboardingChecklist,
} from "~/features/onboarding/api"
import { getSchoolHome, schoolName } from "~/features/school-site/api"
import {
  displayName,
  settingsKeys,
  type DisplaySettings,
} from "~/features/settings/api"
import { OnboardingShell } from "~/features/onboarding/components/onboarding-shell"
import { isApiError } from "~/lib/api/errors"
import { backendFetch } from "~/lib/api/server"
import { requireSchoolSlug } from "~/lib/tenancy/request-host"
import { getSession } from "~/lib/auth"
import { isPortalUser, sessionEndedPath } from "~/lib/auth/home"

/**
 * The setup wizard's own layout (no sidebar). The proxy already lets only
 * staff in, and only school admins while setup is open; this checks
 * again, then loads the member, the display settings and the checklist on
 * the server so the first paint shows the real progress.
 */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const slug = await requireSchoolSlug()
  const session = await getSession()
  if (!session) redirect("/login?next=/onboarding")
  if (isPortalUser(session.user)) redirect("/student")

  const queryClient = new QueryClient()
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: authKeys.me,
      queryFn: () => backendFetch<Me>("/auth/me", { session }),
    }),
    queryClient.prefetchQuery({
      queryKey: settingsKeys.display,
      queryFn: () =>
        backendFetch<DisplaySettings>("/settings/display", { session }),
    }),
    queryClient.prefetchQuery({
      queryKey: onboardingKeys.checklist,
      queryFn: () =>
        backendFetch<OnboardingChecklist>("/onboarding/checklist", {
          session,
        }),
    }),
  ])

  const meError = queryClient.getQueryState(authKeys.me)?.error
  if (isApiError(meError) && meError.status === 401) {
    redirect(sessionEndedPath("/onboarding"))
  }
  // Setup is for those who run it (school admins); the rest wait.
  const me = queryClient.getQueryData<Me>(authKeys.me)
  if (me && !me.isAdmin && !me.permissions.includes("onboarding:manage")) {
    redirect(session.onboardingCompletedAt ? "/dashboard" : "/setting-up")
  }

  const locale = await getLocale()
  const display = queryClient.getQueryData<DisplaySettings>(
    settingsKeys.display
  )
  const name = display
    ? displayName(display, locale)
    : await getSchoolHome(slug)
        .then((home) => schoolName(home, locale))
        .catch(() => slug)

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OnboardingShell schoolName={name}>{children}</OnboardingShell>
    </HydrationBoundary>
  )
}
