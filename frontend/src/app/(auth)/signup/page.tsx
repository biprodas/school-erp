import { headers } from "next/headers";
import TenantSignupView from "~/features/auth/signup";
import PlatformSignupView from "~/features/platform/auth/signup";
import { isPlatformHost } from "~/lib/tenant";

export default async function SignupPage() {
  const host = (await headers()).get("host");
  return isPlatformHost(host) ? <PlatformSignupView /> : <TenantSignupView />;
}
