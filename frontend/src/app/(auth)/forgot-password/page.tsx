import { headers } from "next/headers";
import ForgotPasswordView from "~/features/auth/forgot-password";
import PlatformForgotPasswordView from "~/features/platform/auth/forgot-password";
import { isPlatformHost } from "~/lib/tenant";

export default async function ForgotPasswordPage() {
  const host = (await headers()).get("host");
  return isPlatformHost(host) ? (
    <PlatformForgotPasswordView />
  ) : (
    <ForgotPasswordView />
  );
}
