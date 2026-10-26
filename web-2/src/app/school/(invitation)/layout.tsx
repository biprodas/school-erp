import { SchoolAuthFrame } from "~/features/auth/components/school-auth-frame"

/**
 * The invitation (`/activate`) and waiting-for-setup (`/setting-up`)
 * pages, in the same frame as the other sign-in pages.
 */
export default function InvitationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <SchoolAuthFrame>{children}</SchoolAuthFrame>
}
