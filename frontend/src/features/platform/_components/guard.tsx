"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import type { ReactNode } from "react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { ROUTES } from "~/constants";

/**
 * Gate platform management pages: blocks while loading, redirects non-platform
 * sessions, and (when `requireAdmin`) shows an access notice for non-admins.
 */
export const PlatformGuard = ({
  children,
  requireAdmin = false,
}: {
  children: ReactNode;
  requireAdmin?: boolean;
}) => {
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
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>Platform access required</CardTitle>
          <CardDescription>
            This area is for platform administrators. Please sign in with a
            platform account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={ROUTES.PLATFORM_LOGIN}>Sign in as a platform admin</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (requireAdmin && !session.user.isAdmin) {
    return (
      <Card className="mx-auto w-full max-w-md">
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
