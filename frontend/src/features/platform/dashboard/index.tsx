"use client";

import {
  Building2,
  CircleCheck,
  ShieldUser,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMemo } from "react";
import {
  PLATFORM_MEMBERSHIPS,
  PLATFORM_TENANTS,
  PLATFORM_USERS,
} from "~/constants/routes";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { formatDate } from "~/lib/format";
import { StatusBadge } from "~/features/platform/_components/badges";
import { PlatformGuard } from "~/features/platform/_components/guard";
import { useIsPlatformAdmin } from "~/features/platform/_components/hooks";
import { useMemberships } from "~/apis/platform/memberships/queries";
import { usePlatformUsers } from "~/apis/platform/users/queries";
import { useTenants } from "~/apis/platform/tenants/queries";

export default function PlatformDashboardView() {
  return (
    <PlatformGuard>
      <OverviewContent />
    </PlatformGuard>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  href,
  loading,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  href: string;
  loading?: boolean;
}) {
  return (
    <Link href={href} className="group">
      <Card className="transition-colors group-hover:border-primary/40">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardDescription>{label}</CardDescription>
          <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-5" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tracking-tight">
            {loading ? "—" : value}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function OverviewContent() {
  const { data: session } = useSession();
  const isAdmin = useIsPlatformAdmin();

  const tenantsQuery = useTenants();
  const usersQuery = usePlatformUsers({ enabled: isAdmin });
  const membershipsQuery = useMemberships();

  const tenants = tenantsQuery.data ?? [];
  const activeTenants = useMemo(
    () =>
      (tenantsQuery.data ?? []).filter((t) => t.status === "active").length,
    [tenantsQuery.data],
  );
  const recentTenants = useMemo(
    () =>
      [...(tenantsQuery.data ?? [])]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 5),
    [tenantsQuery.data],
  );

  const user = session!.user;

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Tenants"
          value={tenants.length}
          icon={Building2}
          href={PLATFORM_TENANTS}
          loading={tenantsQuery.isLoading}
        />
        <MetricCard
          label="Active tenants"
          value={activeTenants}
          icon={CircleCheck}
          href={PLATFORM_TENANTS}
          loading={tenantsQuery.isLoading}
        />
        <MetricCard
          label="Memberships"
          value={membershipsQuery.data?.length ?? 0}
          icon={Users}
          href={PLATFORM_MEMBERSHIPS}
          loading={membershipsQuery.isLoading}
        />
        <MetricCard
          label="Platform users"
          value={isAdmin ? (usersQuery.data?.length ?? 0) : "—"}
          icon={ShieldUser}
          href={PLATFORM_USERS}
          loading={isAdmin && usersQuery.isLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent tenants</CardTitle>
            <CardDescription>
              Newest school workspaces on the platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTenants.length ? (
                    recentTenants.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell>
                          <StatusBadge status={t.status} />
                        </TableCell>
                        <TableCell>{formatDate(t.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="h-20 text-center text-muted-foreground"
                      >
                        {tenantsQuery.isLoading ? "Loading…" : "No tenants yet."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your account</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y text-sm">
              <div className="flex items-center justify-between py-3">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium break-all">{user.email}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-muted-foreground">Admin</span>
                {user.isAdmin ? (
                  <Badge>Yes</Badge>
                ) : (
                  <Badge variant="secondary">No</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
