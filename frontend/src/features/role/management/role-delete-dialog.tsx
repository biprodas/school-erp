"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "~/components/confirm-dialog";
import { errorMessage } from "~/apis/tenanted/shared";
import { useDeleteRole } from "~/apis/tenanted/roles/queries";
import type { TenantRole } from "~/apis/tenanted/roles/types";
import { ApiError } from "~/types/api";

interface RoleDeleteDialogProps {
  role: TenantRole | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Deletes a role, escalating to a force-delete when the backend reports the
 * role is still assigned to users (HTTP 409).
 */
export const RoleDeleteDialog = ({
  role,
  onOpenChange,
}: RoleDeleteDialogProps) => {
  const deleteRole = useDeleteRole();
  // When set, the role is still assigned and we show a force-delete prompt
  // carrying the backend's message (which includes the assignment count).
  const [forceMessage, setForceMessage] = useState<string | null>(null);

  const close = () => {
    setForceMessage(null);
    onOpenChange(false);
  };

  const handleDelete = async (force: boolean) => {
    if (!role) return;
    try {
      await deleteRole.mutateAsync({ id: role.id, force });
      close();
    } catch (e) {
      if (!force && e instanceof ApiError && e.status === 409) {
        // Role still assigned — offer to force-delete.
        setForceMessage(e.message);
        return;
      }
      toast.error(errorMessage(e, "Failed to delete role"));
      close();
    }
  };

  if (forceMessage) {
    return (
      <ConfirmDialog
        open
        onOpenChange={(o) => !o && close()}
        title="Force delete role?"
        description={
          <>
            {forceMessage} Deleting <strong>{role?.name}</strong> will also
            remove it from those users.
          </>
        }
        confirmLabel="Force delete"
        isPending={deleteRole.isPending}
        onConfirm={() => void handleDelete(true)}
      />
    );
  }

  return (
    <ConfirmDialog
      open={Boolean(role)}
      onOpenChange={(o) => !o && close()}
      title="Delete role?"
      description={
        <>
          This permanently deletes the <strong>{role?.name}</strong> role. This
          action cannot be undone.
        </>
      }
      confirmLabel="Delete role"
      isPending={deleteRole.isPending}
      onConfirm={() => void handleDelete(false)}
    />
  );
};
