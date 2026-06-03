"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Building2, ShieldUser, Users } from "lucide-react";
import type { ReactNode } from "react";
import { PLATFORM_LOGIN } from "~/constants/routes";
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

const MANAGEMENT_AREAS = [
  {
    title: "Tenants",
    description: "Create and manage school workspaces.",
    icon: Building2,
  },
  {
    title: "Platform Users",
    description: "Manage super-admin and platform accounts.",
    icon: ShieldUser,
  },
  {
    title: "Memberships",
    description: "Assign users to tenants and roles.",
    icon: Users,
  },
] as const;

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right break-all">
        {children}
      </span>
    </div>
  );
}

export default function PlatformDashboardView() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full max-w-2xl rounded-xl" />
      </div>
    );
  }

  if (!session?.user) return null;

  // The route is auth-gated by the proxy, but a tenant session could still land
  // here — keep the two surfaces separate.
  if (session.authKind !== "platform") {
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

  const { user } = session;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Welcome, {user.name ?? "Admin"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Platform administration overview
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Your account</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y">
            <DetailRow label="Email">{user.email}</DetailRow>
            <DetailRow label="Account type">
              <span className="capitalize">{session.authKind}</span>
            </DetailRow>
            <DetailRow label="Role">
              {user.role ? (
                <Badge variant="outline" className="capitalize">
                  {user.role}
                </Badge>
              ) : (
                "—"
              )}
            </DetailRow>
            <DetailRow label="Admin">
              {user.isAdmin ? (
                <Badge>Yes</Badge>
              ) : (
                <Badge variant="secondary">No</Badge>
              )}
            </DetailRow>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MANAGEMENT_AREAS.map(({ title, description, icon: Icon }) => (
          <Card key={title}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Icon className="size-5" />
                </div>
                <CardTitle className="text-base">{title}</CardTitle>
              </div>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">Coming soon</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
