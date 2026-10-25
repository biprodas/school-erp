import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query"
import { redirect } from "next/navigation"
import { getLocale } from "next-intl/server"

import { authKeys, type Me } from "~/features/auth/api"
import { portalKeys, type PortalChild } from "~/features/portal/api"
import { getSchoolHome, schoolName } from "~/features/school-site/api"
import {
  displayName,
  settingsKeys,
  type DisplaySettings,
} from "~/features/settings/api"
import { PortalShell } from "~/features/portal/components/portal-shell"
import { isApiError } from "~/lib/api/errors"
import { backendFetch } from "~/lib/api/server"
import { requireSchoolSlug } from "~/lib/tenancy/request-host"
import { getSession } from "~/lib/auth"
import { isPortalUser, sessionEndedPath } from "~/lib/auth/home"

/**
 * The guardian and student portal (doc/frontend-implementation-plan.md
 * 5.6). Loads the member, the display settings and the children on the
 * server, so the first paint has the child picker filled in. Staff
 * without `portal:access` (the backend answers 403) go to their own home.
 */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const slug = await requireSchoolSlug()
  const session = await getSession()
  if (!session) redirect("/login?next=/student")

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
      queryKey: portalKeys.children,
      queryFn: () =>
        backendFetch<PortalChild[]>("/portal/children", { session }),
    }),
  ])

  const meError = queryClient.getQueryState(authKeys.me)?.error
  if (isApiError(meError) && meError.status === 401) {
    redirect(sessionEndedPath("/student"))
  }
  const childrenError = queryClient.getQueryState(portalKeys.children)?.error
  if (
    isApiError(childrenError) &&
    childrenError.status === 403 &&
    !isPortalUser(session.user)
  ) {
    redirect("/dashboard")
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
      <PortalShell schoolName={name} user={session.user}>
        {children}
      </PortalShell>
    </HydrationBoundary>
  )
}
