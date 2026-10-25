import { redirect } from "next/navigation"

import { AdminShell } from "~/features/platform/shell/components/admin-shell"
import { getSession } from "~/lib/auth"
import { canOpenConsole } from "~/lib/auth/home"

/**
 * The platform console. The proxy already sent visitors without a
 * platform session to `/login`; this checks again, and refuses accounts
 * whose platform role has no console (sign-in never stores one, but a
 * cookie from before platform roles might).
 */
export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session || session.realm !== "platform") redirect("/login")
  if (!canOpenConsole(session.user)) redirect("/login?error=not_admin")

  return <AdminShell user={session.user}>{children}</AdminShell>
}
