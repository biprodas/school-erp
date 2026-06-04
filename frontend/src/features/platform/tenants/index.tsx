"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowLeftRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
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
import { ConfirmDialog } from "~/components/confirm-dialog";
import { formatDate } from "~/lib/format";
import { StatusBadge } from "~/features/platform/_components/badges";
import { PageHeader } from "~/features/platform/_components/page-header";
import { PlatformGuard } from "~/features/platform/_components/guard";
import { useIsPlatformAdmin } from "~/features/platform/_components/hooks";
import { useDeleteTenant, useTenants } from "~/apis/platform/tenants/queries";
import { usePlatformUsers } from "~/apis/platform/users/queries";
import type { PlatformTenant } from "~/apis/platform/tenants/types";
import { TenantFormDialog } from "./tenant-form-dialog";
import { TransferOwnershipDialog } from "./transfer-ownership-dialog";

export default function PlatformTenantsView() {
  return (
    <PlatformGuard>
      <TenantsContent />
    </PlatformGuard>
  );
}

function TenantsContent() {
  const isAdmin = useIsPlatformAdmin();
  const tenantsQuery = useTenants();
  // Owner / transfer selects need the users list (admin-only endpoint).
  const usersQuery = usePlatformUsers({ enabled: isAdmin });
  const deleteTenant = useDeleteTenant();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformTenant | null>(null);
  const [transferring, setTransferring] = useState<PlatformTenant | null>(null);
  const [deleting, setDeleting] = useState<PlatformTenant | null>(null);

  const users = usersQuery.data ?? [];

  const columns = useMemo<ColumnDef<PlatformTenant>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "slug",
        header: "Slug",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.slug}
          </span>
        ),
      },
      {
        accessorKey: "domain",
        header: "Domain",
        cell: ({ row }) => row.original.domain ?? "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const tenant = row.original;
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
                  <DropdownMenuItem onSelect={() => setEditing(tenant)}>
                    <Pencil className="size-4" />
                    Edit
                  </DropdownMenuItem>
                  {isAdmin ? (
                    <DropdownMenuItem onSelect={() => setTransferring(tenant)}>
                      <ArrowLeftRight className="size-4" />
                      Transfer ownership
                    </DropdownMenuItem>
                  ) : null}
                  {isAdmin ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeleting(tenant)}
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  ) : null}
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
        title="Tenants"
        description="Create and manage school workspaces."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Create tenant
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={tenantsQuery.data ?? []}
        isLoading={tenantsQuery.isLoading}
        searchPlaceholder="Search tenants…"
        emptyMessage="No tenants yet."
      />

      <TenantFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        users={users}
        isAdmin={isAdmin}
      />

      <TenantFormDialog
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        tenant={editing ?? undefined}
      />

      <TransferOwnershipDialog
        open={Boolean(transferring)}
        onOpenChange={(o) => !o && setTransferring(null)}
        tenant={transferring}
        users={users}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete tenant?"
        description={
          <>
            This permanently deletes <strong>{deleting?.name}</strong> and drops
            its database schema. This action cannot be undone.
          </>
        }
        confirmLabel="Delete tenant"
        isPending={deleteTenant.isPending}
        onConfirm={() => {
          if (!deleting) return;
          deleteTenant.mutate(deleting.id, {
            onSuccess: () => setDeleting(null),
          });
        }}
      />
    </div>
  );
}
