import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";

import { TENANT_LOGIN, TENANT_SIGNUP } from "~/constants/routes";
import { Button } from "~/components/ui/button";
import { ThemeToggleButton } from "~/components/theme-toggle-button";
import type { PublicTenant } from "./api";

export default function TenantLandingView({
  tenant,
}: {
  tenant: PublicTenant;
}) {
  return (
    <div className="relative flex min-h-svh flex-col bg-muted">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
            <GraduationCap className="size-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            {tenant.name}
          </span>
        </div>
        <ThemeToggleButton />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary">
          <GraduationCap className="size-7 text-primary-foreground" />
        </div>
        <h1 className="max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Welcome to {tenant.name}
        </h1>
        <p className="max-w-md text-balance text-muted-foreground">
          Sign in to access your dashboard, or create an account to get started.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link href={TENANT_SIGNUP}>
              Get started <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href={TENANT_LOGIN}>Log in</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
