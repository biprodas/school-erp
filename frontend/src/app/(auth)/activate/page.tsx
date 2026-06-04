import { Suspense } from "react";
import ActivateView from "~/features/auth/activate";

export default function ActivatePage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <Suspense fallback={null}>
        <ActivateView />
      </Suspense>
    </div>
  );
}
