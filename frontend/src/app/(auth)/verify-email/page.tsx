import { headers } from "next/headers";
import { Suspense } from "react";
import VerifyEmailView from "~/features/auth/verify-email";
import PlatformVerifyEmailView from "~/features/platform/auth/verify-email";
import { isPlatformHost } from "~/lib/tenant";

export default async function VerifyEmailPage() {
  const host = (await headers()).get("host");
  const platform = isPlatformHost(host);
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <Suspense fallback={null}>
        {platform ? <PlatformVerifyEmailView /> : <VerifyEmailView />}
      </Suspense>
    </div>
  );
}
