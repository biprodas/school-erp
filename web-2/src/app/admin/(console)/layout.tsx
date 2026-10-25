import { redirect } from "next/navigation"

import { AdminShell } from "~/features/platform/shell/components/admin-shell"
import { getSession } from "~/lib/auth"

/**
 * The platform console. The proxy already sent visitors without a
 * platform session to `/login`; this checks again, and refuses accounts
 * that aren't platform admins (sign-in never stores one, but an old
 * cookie might).
 */
export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session || session.realm !== "platform") redirect("/login")
  if (!session.user.isAdmin) redirect("/login?error=not_admin")

  return <AdminShell user={session.user}>{children}</AdminShell>
}
