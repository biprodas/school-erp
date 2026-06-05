"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontal,
  Pencil,
  Plus,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
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
import { ConfirmDialog } from "~/components/confirm-dialog";
import { formatDate } from "~/lib/format";
import { RoleBadge, StatusBadge } from "~/features/platform/_components/badges";
import { PageHeader } from "~/features/platform/_components/page-header";
import {
  useDeleteTenantUser,
  useGrantAdmin,
  useRevokeAdmin,
  useTenantUsers,
} from "~/apis/tenanted/users/queries";
import type { TenantUserRow } from "~/apis/tenanted/users/types";
import { UserFormDialog } from "./user-form-dialog";

export default function TenantUsersView() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const isAdmin = Boolean(session?.user?.isAdmin);

  const usersQuery = useTenantUsers();
  const deleteUser = useDeleteTenantUser();
  const grantAdmin = useGrantAdmin();
  const revokeAdmin = useRevokeAdmin();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TenantUserRow | null>(null);
  const [deleting, setDeleting] = useState<TenantUserRow | null>(null);

  const columns = useMemo<ColumnDef<TenantUserRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.email}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "roles",
        header: "Roles",
        enableSorting: false,
        cell: ({ row }) => {
          const roles = row.original.roles;
          if (roles.length === 0) {
            return <span className="text-muted-foreground text-sm">—</span>;
          }
          return (
            <div className="flex flex-wrap gap-1">
              {roles.map((role) => (
                <RoleBadge key={role.id} role={role.name} />
              ))}
            </div>
          );
        },
      },
      {
        accessorKey: "isAdmin",
        header: "Admin",
        cell: ({ row }) =>
          row.original.isAdmin ? (
            <Badge>Yes</Badge>
          ) : (
            <Badge variant="secondary">No</Badge>
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
          const user = row.original;
          const isSelf = user.id === currentUserId;
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
                  <DropdownMenuItem onSelect={() => setEditing(user)}>
                    <Pencil className="size-4" />
                    Edit
                  </DropdownMenuItem>
                  {isAdmin ? (
                    user.isAdmin ? (
                      <DropdownMenuItem
                        disabled={isSelf || revokeAdmin.isPending}
                        onSelect={() =>
                          !isSelf && revokeAdmin.mutate(user.id)
                        }
                      >
                        <ShieldOff className="size-4" />
                        Revoke admin
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        disabled={grantAdmin.isPending}
                        onSelect={() => grantAdmin.mutate(user.id)}
                      >
                        <ShieldCheck className="size-4" />
                        Grant admin
                      </DropdownMenuItem>
                    )
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={isSelf}
                    onSelect={() => !isSelf && setDeleting(user)}
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
    [currentUserId, isAdmin, grantAdmin, revokeAdmin],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="User management"
        description="Manage staff accounts, their status, and role assignments."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Create user
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={usersQuery.data ?? []}
        isLoading={usersQuery.isLoading}
        searchPlaceholder="Search users…"
        emptyMessage="No users yet."
      />

      <UserFormDialog open={createOpen} onOpenChange={setCreateOpen} />

      <UserFormDialog
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        user={editing ?? undefined}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete user?"
        description={
          <>
            This permanently deletes <strong>{deleting?.email}</strong>. This
            action cannot be undone.
          </>
        }
        confirmLabel="Delete user"
        isPending={deleteUser.isPending}
        onConfirm={() => {
          if (!deleting) return;
          deleteUser.mutate(deleting.id, {
            onSuccess: () => setDeleting(null),
          });
        }}
      />
    </div>
  );
}
