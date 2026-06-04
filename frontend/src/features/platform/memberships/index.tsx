"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "~/components/data-table";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { ConfirmDialog } from "~/features/platform/management/confirm-dialog";
import {
  PageHeader,
  PlatformGuard,
  RoleBadge,
  formatDate,
  useIsPlatformAdmin,
} from "~/features/platform/management/components";
import {
  useDeleteMembership,
  useMemberships,
  usePlatformUsers,
  useTenants,
} from "~/features/platform/management/hooks";
import type { Membership } from "~/types/platform";
import {
  CreateMembershipDialog,
  EditMembershipRoleDialog,
} from "./membership-form-dialog";

/** A membership joined with its user/tenant display fields (client-side). */
interface MembershipRow extends Membership {
  userLabel: string;
  userEmail: string;
  tenantLabel: string;
}

export default function PlatformMembershipsView() {
  return (
    <PlatformGuard>
      <MembershipsContent />
    </PlatformGuard>
  );
}

function MembershipsContent() {
  const isAdmin = useIsPlatformAdmin();
  const membershipsQuery = useMemberships();
  const tenantsQuery = useTenants();
  // Users come from the admin-only endpoint; non-admins join on id fallback.
  const usersQuery = usePlatformUsers({ enabled: isAdmin });
  const deleteMembership = useDeleteMembership();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<MembershipRow | null>(null);
  const [deleting, setDeleting] = useState<MembershipRow | null>(null);

  const users = usersQuery.data ?? [];
  const tenants = tenantsQuery.data ?? [];

  const rows = useMemo<MembershipRow[]>(() => {
    const userById = new Map((usersQuery.data ?? []).map((u) => [u.id, u]));
    const tenantById = new Map((tenantsQuery.data ?? []).map((t) => [t.id, t]));
    return (membershipsQuery.data ?? []).map((m) => {
      const u = userById.get(m.userId);
      const t = tenantById.get(m.tenantId);
      return {
        ...m,
        userLabel: u?.name ?? `${m.userId.slice(0, 8)}…`,
        userEmail: u?.email ?? "",
        tenantLabel: t?.name ?? `${m.tenantId.slice(0, 8)}…`,
      };
    });
  }, [membershipsQuery.data, usersQuery.data, tenantsQuery.data]);

  const columns = useMemo<ColumnDef<MembershipRow>[]>(
    () => [
      {
        accessorKey: "userLabel",
        header: "User",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.userLabel}</span>
            {row.original.userEmail ? (
              <span className="text-xs text-muted-foreground">
                {row.original.userEmail}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "tenantLabel",
        header: "Tenant",
        cell: ({ row }) => row.original.tenantLabel,
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => <RoleBadge role={row.original.role} />,
      },
      {
        accessorKey: "createdAt",
        header: "Since",
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const m = row.original;
          // OWNER rows are admin-only to modify; non-admins get no row actions.
          const canManage = isAdmin || m.role !== "owner";
          if (!isAdmin && !canManage) return null;
          if (!isAdmin) return null;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8">
                    <MoreHorizontal className="size-4" />
                    <span className="sr-only">Open actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditing(m)}>
                    <Pencil className="size-4" />
                    Change role
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDeleting(m)}
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [isAdmin],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Memberships"
        description="Assign users to tenants and roles."
        actions={
          isAdmin ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Add membership
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={rows}
        isLoading={membershipsQuery.isLoading}
        searchPlaceholder="Search memberships…"
        emptyMessage="No memberships."
      />

      <CreateMembershipDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        users={users}
        tenants={tenants}
        isAdmin={isAdmin}
      />

      <EditMembershipRoleDialog
        key={editing?.id ?? "none"}
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        membership={editing}
        label={editing ? `${editing.userLabel} @ ${editing.tenantLabel}` : undefined}
        isAdmin={isAdmin}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remove membership?"
        description={
          <>
            Remove <strong>{deleting?.userLabel}</strong> from{" "}
            <strong>{deleting?.tenantLabel}</strong>?
          </>
        }
        confirmLabel="Remove"
        isPending={deleteMembership.isPending}
        onConfirm={() => {
          if (!deleting) return;
          deleteMembership.mutate(deleting.id, {
            onSuccess: () => setDeleting(null),
          });
        }}
      />
    </div>
  );
}
