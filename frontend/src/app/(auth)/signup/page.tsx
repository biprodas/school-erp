import { headers } from "next/headers";
import TenantSignupNotice from "~/features/auth/signup/tenant-signup-notice";
import PlatformSignupView from "~/features/platform/auth/signup";
import { isPlatformHost } from "~/lib/tenant";

export default async function SignupPage() {
  const host = (await headers()).get("host");
  // Platform self-signup stays; tenant self-registration is disabled (owners
  // and staff are provisioned by an admin and activate via a link).
  return isPlatformHost(host) ? <PlatformSignupView /> : <TenantSignupNotice />;
}
