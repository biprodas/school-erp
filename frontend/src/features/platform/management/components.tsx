"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import type { ReactNode } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { PLATFORM_LOGIN } from "~/constants/routes";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  active: "default",
  pending: "secondary",
  suspended: "destructive",
  banned: "destructive",
  inactive: "outline",
  deactivated: "outline",
  archived: "outline",
};

const ROLE_VARIANT: Record<string, BadgeVariant> = {
  owner: "default",
  admin: "secondary",
  member: "outline",
  user: "outline",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "outline"} className="capitalize">
      {status}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: string }) {
  return (
    <Badge variant={ROLE_VARIANT[role] ?? "outline"} className="capitalize">
      {role}
    </Badge>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * Gate platform management pages: blocks while loading, redirects non-platform
 * sessions, and (when `requireAdmin`) shows an access notice for non-admins.
 */
export function PlatformGuard({
  children,
  requireAdmin = false,
}: {
  children: ReactNode;
  requireAdmin?: boolean;
}) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!session?.user || session.authKind !== "platform") {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Platform access required</CardTitle>
          <CardDescription>
            This area is for platform administrators. Please sign in with a
            platform account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={PLATFORM_LOGIN}>Sign in as a platform admin</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (requireAdmin && !session.user.isAdmin) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Admin access required</CardTitle>
          <CardDescription>
            Your platform account doesn&apos;t have permission to view this
            section. Contact a platform administrator if you need access.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return <>{children}</>;
}

/** Short, locale-aware date for table cells. Falls back to the raw value. */
export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Convenience hook: is the current session an admin platform user? */
export function useIsPlatformAdmin(): boolean {
  const { data: session } = useSession();
  return Boolean(
    session?.authKind === "platform" && session.user?.isAdmin,
  );
}
