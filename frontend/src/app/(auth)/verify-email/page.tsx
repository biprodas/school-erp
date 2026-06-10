import { Suspense } from "react";
import VerifyEmailView from "~/features/auth/verify-email";

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <Suspense fallback={null}>
        <VerifyEmailView />
      </Suspense>
    </div>
  );
}
