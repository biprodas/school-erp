"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "~/components/data-table";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { formatDate } from "~/lib/format";
import { RoleBadge } from "~/features/platform/_components/badges";
import { PageHeader } from "~/features/platform/_components/page-header";
import { useTenantPermissionCatalog } from "~/apis/tenanted/permissions/queries";
import { useTenantRoles } from "~/apis/tenanted/roles/queries";
import type { TenantRole } from "~/apis/tenanted/roles/types";
import { RoleDeleteDialog } from "./role-delete-dialog";
import { RoleFormDialog } from "./role-form-dialog";

export default function TenantRolesView() {
  const rolesQuery = useTenantRoles();
  const catalogQuery = useTenantPermissionCatalog();

  const totalPermissions = useMemo(
    () =>
      (catalogQuery.data ?? []).reduce(
        (sum, group) => sum + group.permissions.length,
        0,
      ),
    [catalogQuery.data],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TenantRole | null>(null);
  const [deleting, setDeleting] = useState<TenantRole | null>(null);

  const columns = useMemo<ColumnDef<TenantRole>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => <RoleBadge role={row.original.name} />,
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.description || "—"}
          </span>
        ),
      },
      {
        id: "permissions",
        header: "Permissions",
        enableSorting: false,
        cell: ({ row }) => {
          const count = row.original.permissions.length;
          const all = totalPermissions > 0 && count >= totalPermissions;
          return (
            <span className="text-sm">
              {all ? "All permissions" : `${count} permission${count === 1 ? "" : "s"}`}
            </span>
          );
        },
      },
      {
        accessorKey: "isSystem",
        header: "Type",
        cell: ({ row }) =>
          row.original.isSystem ? (
            <Badge variant="secondary">System</Badge>
          ) : (
            <Badge variant="outline">Custom</Badge>
          ),
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
          const role = row.original;
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
                  <DropdownMenuItem onSelect={() => setEditing(role)}>
                    <Pencil className="size-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={role.isSystem}
                    onSelect={() => !role.isSystem && setDeleting(role)}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [totalPermissions],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & permissions"
        description="Define roles and the permissions they grant. Assign roles to users from User management."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Create role
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={rolesQuery.data ?? []}
        isLoading={rolesQuery.isLoading}
        searchPlaceholder="Search roles…"
        emptyMessage="No roles yet."
      />

      <RoleFormDialog open={createOpen} onOpenChange={setCreateOpen} />

      <RoleFormDialog
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        role={editing ?? undefined}
      />

      <RoleDeleteDialog
        role={deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      />
    </div>
  );
}
