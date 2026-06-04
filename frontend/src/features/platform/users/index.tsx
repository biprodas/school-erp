"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
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
import { PlatformGuard } from "~/features/platform/_components/guard";
import { useDeleteUser, usePlatformUsers } from "~/apis/platform/users/queries";
import type { PlatformUserRow } from "~/apis/platform/users/types";
import { UserFormDialog } from "./user-form-dialog";

export default function PlatformUsersView() {
  return (
    <PlatformGuard requireAdmin>
      <UsersContent />
    </PlatformGuard>
  );
}

function UsersContent() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const usersQuery = usePlatformUsers();
  const deleteUser = useDeleteUser();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformUserRow | null>(null);
  const [deleting, setDeleting] = useState<PlatformUserRow | null>(null);

  const columns = useMemo<ColumnDef<PlatformUserRow>[]>(
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
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => <RoleBadge role={row.original.role} />,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
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
    [currentUserId],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform users"
        description="Manage super-admin and platform accounts."
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
        emptyMessage="No platform users."
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
