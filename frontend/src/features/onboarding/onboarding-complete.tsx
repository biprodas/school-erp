"use client";

import { CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCompleteOnboarding } from "~/apis/platform/tenants/queries";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { PLATFORM_LOGIN_REDIRECT } from "~/constants/routes";

/**
 * Final onboarding step (apex): a brief welcome that marks the tenant's bootstrap
 * `completed` (via the platform session) and sends the owner to the platform
 * dashboard. Marking completion is idempotent, so a failure here is non-fatal.
 */
export function OnboardingComplete({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const complete = useCompleteOnboarding();

  const goToDashboard = async () => {
    try {
      await complete.mutateAsync(tenantId);
    } catch {
      // Non-fatal: the platform resume gate will re-route if needed.
    }
    router.push(PLATFORM_LOGIN_REDIRECT);
    router.refresh();
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="items-center text-center">
        <CheckCircle2Icon className="size-10 text-primary" />
        <CardTitle>You&apos;re all set!</CardTitle>
        <CardDescription>
          Your school workspace is ready. Head to the dashboard to start adding
          students, staff, and more.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          className="w-full"
          onClick={goToDashboard}
          disabled={complete.isPending}
        >
          {complete.isPending ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              Finishing up…
            </>
          ) : (
            "Go to dashboard"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
