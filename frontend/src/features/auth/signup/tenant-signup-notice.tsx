import Link from "next/link";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { TENANT_LOGIN } from "~/constants/routes";

/**
 * Tenant self-registration is disabled — accounts are provisioned by an admin
 * who shares an activation link. Shown on tenant hosts at `/signup`.
 */
export default function TenantSignupNotice() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign-up is by invitation</CardTitle>
          <CardDescription>
            Accounts for this workspace are created by an administrator. Ask
            them for an activation link, or sign in if you already have an
            account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={TENANT_LOGIN}>Go to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
