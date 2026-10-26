import { SchoolAuthFrame } from "~/features/auth/components/school-auth-frame"

/** Sign-in, password and setup pages on a school host. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <SchoolAuthFrame>{children}</SchoolAuthFrame>
}
