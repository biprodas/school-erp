import { headers } from "next/headers";
import TenantLoginView from "~/features/auth/login";
import PlatformLoginView from "~/features/platform/auth/login";
import { isPlatformHost } from "~/lib/tenant";

export default async function LoginPage() {
  const host = (await headers()).get("host");
  return isPlatformHost(host) ? <PlatformLoginView /> : <TenantLoginView />;
}
