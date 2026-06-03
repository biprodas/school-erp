"use client";

import { useSession } from "next-auth/react";
import type { ReactNode } from "react";
import { useCurrentUser } from "~/features/auth/hooks";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";

interface MeData {
  status?: string;
  createdAt?: string;
}

function getInitials(name: string): string {
  return (
    name
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"
  );
}

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

export default function ProfileView() {
  const { data: session, status } = useSession();
  const meQuery = useCurrentUser<MeData>();

  if (status === "loading") {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!session?.user) return null;

  const { user, authKind } = session;
  const name = user.name ?? "Account";
  const email = user.email ?? "";
  const initials = getInitials(name);

  const roleList =
    authKind === "platform"
      ? user.role
        ? [user.role]
        : []
      : (user.roles ?? []);

  const me = meQuery.data;
  const createdAt = me?.createdAt
    ? new Date(me.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="size-16 rounded-xl">
            <AvatarImage src={user.image ?? ""} alt={name} />
            <AvatarFallback className="rounded-xl bg-primary text-white text-lg font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <CardTitle className="text-xl">{name}</CardTitle>
            <p className="text-sm text-muted-foreground">{email}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="secondary" className="capitalize">
                {authKind}
              </Badge>
              {user.isAdmin && <Badge>Admin</Badge>}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account details</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y">
            <DetailRow label="User ID">{user.id}</DetailRow>
            <DetailRow label="Email">{email}</DetailRow>
            <DetailRow label="Account type">
              <span className="capitalize">{authKind}</span>
            </DetailRow>
            <DetailRow label="Role(s)">
              {roleList.length ? (
                <span className="flex flex-wrap justify-end gap-1">
                  {roleList.map((role) => (
                    <Badge key={role} variant="outline" className="capitalize">
                      {role}
                    </Badge>
                  ))}
                </span>
              ) : (
                "—"
              )}
            </DetailRow>
            <DetailRow label="Admin">{user.isAdmin ? "Yes" : "No"}</DetailRow>
            {authKind === "tenant" && user.tenant?.slug && (
              <DetailRow label="Workspace">{user.tenant.slug}</DetailRow>
            )}
            <DetailRow label="Status">
              {meQuery.isPending ? (
                <Skeleton className="h-4 w-16" />
              ) : me?.status ? (
                <span className="capitalize">{me.status}</span>
              ) : (
                "—"
              )}
            </DetailRow>
            {(meQuery.isPending || createdAt) && (
              <DetailRow label="Member since">
                {meQuery.isPending ? (
                  <Skeleton className="h-4 w-24" />
                ) : (
                  createdAt
                )}
              </DetailRow>
            )}
          </div>
          <Separator className="my-2 opacity-0" />
        </CardContent>
      </Card>
    </div>
  );
}
