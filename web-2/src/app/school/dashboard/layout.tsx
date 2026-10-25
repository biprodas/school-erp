import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getLocale } from "next-intl/server"

import { authKeys, type Me } from "~/api/auth"
import { getSchoolHome, schoolName } from "~/api/public/school-home"
import { displayName, settingsKeys, type DisplaySettings } from "~/api/settings"
import { DashboardShell } from "~/components/layout/dashboard-shell"
import { isApiError } from "~/lib/api/errors"
import { backendFetch } from "~/lib/api/server"
import { requireSchoolSlug } from "~/lib/tenancy/request-host"
import { getSession } from "~/lib/auth"
import { isPortalUser, sessionEndedPath } from "~/lib/auth/home"

/** Set by `SidebarProvider` when the sidebar is opened or collapsed. */
const SIDEBAR_COOKIE = "sidebar_state"

/**
 * The staff app shell (doc/frontend-implementation-plan.md 5.4). The proxy
 * already sent visitors without a staff session elsewhere; this checks
 * again, then loads the member (with permissions) and the school's
 * display settings on the server, so the first paint has the right menus.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const slug = await requireSchoolSlug()
  const session = await getSession()
  if (!session) redirect("/login?next=/dashboard")
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
  ])

  // The session ended since the proxy read the cookie.
  const meError = queryClient.getQueryState(authKeys.me)?.error
  if (isApiError(meError) && meError.status === 401) {
    redirect(sessionEndedPath("/dashboard"))
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

  const sidebar = (await cookies()).get(SIDEBAR_COOKIE)?.value

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardShell
        defaultOpen={sidebar !== "false"}
        schoolName={name}
        user={session.user}
      >
        {children}
      </DashboardShell>
    </HydrationBoundary>
  )
}
