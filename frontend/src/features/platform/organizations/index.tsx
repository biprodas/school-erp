"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowLeftRight,
  ExternalLink,
  KeyRound,
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
import { ROUTES } from "~/constants";
import { formatDate } from "~/lib/format";
import { buildTenantUrl } from "~/lib/tenant";
import { StatusBadge } from "~/features/platform/_components/badges";
import { PageHeader } from "~/features/platform/_components/page-header";
import { PlatformGuard } from "~/features/platform/_components/guard";
import { useIsPlatformAdmin } from "~/features/platform/_components/hooks";
import {
  useDeleteOrganization,
  useReissueOwnerActivation,
  useOrganizations,
} from "~/apis/platform/organizations/queries";
import { usePlatformUsers } from "~/apis/platform/users/queries";
import type {
  OwnerActivation,
  PlatformOrganization,
} from "~/apis/platform/organizations/types";
import { ActivationLinkDialog } from "./activation-link-dialog";
import { OrganizationFormDialog } from "./organization-form-dialog";
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
  const tenantsQuery = useOrganizations();
  // Owner / transfer selects need the users list (admin-only endpoint).
  const usersQuery = usePlatformUsers({ enabled: isAdmin });
  const deleteOrganization = useDeleteOrganization();
  const reissue = useReissueOwnerActivation();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformOrganization | null>(null);
  const [transferring, setTransferring] = useState<PlatformOrganization | null>(null);
  const [deleting, setDeleting] = useState<PlatformOrganization | null>(null);
  const [activation, setActivation] = useState<OwnerActivation | null>(null);

  const users = usersQuery.data ?? [];

  const columns = useMemo<ColumnDef<PlatformOrganization>[]>(
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
                  <DropdownMenuItem
                    onSelect={() =>
                      window.open(
                        buildTenantUrl(tenant.slug, ROUTES.DEFAULT_LOGIN_REDIRECT),
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  >
                    <ExternalLink className="size-4" />
                    Open school
                  </DropdownMenuItem>
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
                    <DropdownMenuItem
                      onSelect={() =>
                        reissue.mutate(tenant.id, {
                          onSuccess: (data) => setActivation(data),
                        })
                      }
                    >
                      <KeyRound className="size-4" />
                      Copy owner activation link
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
    [isAdmin, reissue],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
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
        searchPlaceholder="Search organizations…"
        emptyMessage="No organizations yet."
      />

      <OrganizationFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        users={users}
        isAdmin={isAdmin}
        onOwnerActivation={setActivation}
      />

      <OrganizationFormDialog
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        tenant={editing ?? undefined}
      />

      <TransferOwnershipDialog
        open={Boolean(transferring)}
        onOpenChange={(o) => !o && setTransferring(null)}
        tenant={transferring}
        users={users}
        onOwnerActivation={setActivation}
      />

      <ActivationLinkDialog
        open={Boolean(activation)}
        onOpenChange={(o) => !o && setActivation(null)}
        activation={activation}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete organization?"
        description={
          <>
            This permanently deletes <strong>{deleting?.name}</strong> and all
            of its school data. This action cannot be undone.
          </>
        }
        confirmLabel="Delete organization"
        isPending={deleteOrganization.isPending}
        onConfirm={() => {
          if (!deleting) return;
          deleteOrganization.mutate(deleting.id, {
            onSuccess: () => setDeleting(null),
          });
        }}
      />
    </div>
  );
}
