"use client";

import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Field, FieldLabel } from "~/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useTransferOwnership } from "~/apis/platform/tenants/queries";
import {
  DEMOTE_OPTIONS,
  type DemoteOldOwnerTo,
  type OwnerActivation,
  type PlatformTenant,
} from "~/apis/platform/tenants/types";
import type { PlatformUserRow } from "~/apis/platform/users/types";

const DEMOTE_LABELS: Record<DemoteOldOwnerTo, string> = {
  admin: "Demote previous owner to admin",
  member: "Demote previous owner to member",
  remove: "Remove previous owner",
};

interface TransferOwnershipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: PlatformTenant | null;
  users: PlatformUserRow[];
  onOwnerActivation?: (activation: OwnerActivation) => void;
}

export const TransferOwnershipDialog = ({
  open,
  onOpenChange,
  tenant,
  users,
  onOwnerActivation,
}: TransferOwnershipDialogProps) => {
  const transfer = useTransferOwnership();
  const [newOwnerUserId, setNewOwnerUserId] = useState("");
  const [demoteOldOwnerTo, setDemoteOldOwnerTo] =
    useState<DemoteOldOwnerTo>("admin");

  // Reset local state whenever a new tenant is targeted.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setNewOwnerUserId("");
      setDemoteOldOwnerTo("admin");
    }
    onOpenChange(next);
  };

  const onSubmit = async () => {
    if (!tenant || !newOwnerUserId) return;
    const result = await transfer.mutateAsync({
      id: tenant.id,
      payload: { newOwnerUserId, demoteOldOwnerTo },
    });
    handleOpenChange(false);
    if (result.activation) onOwnerActivation?.(result.activation);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer ownership</DialogTitle>
          <DialogDescription>
            {tenant
              ? `Assign a new owner for ${tenant.name}.`
              : "Assign a new owner."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field className="gap-1">
            <FieldLabel htmlFor="new-owner">New owner</FieldLabel>
            <Select value={newOwnerUserId} onValueChange={setNewOwnerUserId}>
              <SelectTrigger id="new-owner" className="w-full">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field className="gap-1">
            <FieldLabel htmlFor="demote-to">Previous owner</FieldLabel>
            <Select
              value={demoteOldOwnerTo}
              onValueChange={(v) => setDemoteOldOwnerTo(v as DemoteOldOwnerTo)}
            >
              <SelectTrigger id="demote-to" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEMOTE_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {DEMOTE_LABELS[opt]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <DialogFooter className="mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={transfer.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={transfer.isPending || !newOwnerUserId}
          >
            {transfer.isPending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Transferring…
              </>
            ) : (
              "Transfer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
