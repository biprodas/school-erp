import { headers } from "next/headers";
import ResetPasswordView from "~/features/auth/reset-password";
import PlatformResetPasswordView from "~/features/platform/auth/reset-password";
import { isPlatformHost } from "~/lib/tenant";

export default async function ResetPasswordPage() {
  const host = (await headers()).get("host");
  return isPlatformHost(host) ? (
    <PlatformResetPasswordView />
  ) : (
    <ResetPasswordView />
  );
}
