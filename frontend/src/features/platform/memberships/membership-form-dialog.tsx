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
import {
  useCreateMembership,
  useUpdateMembershipRole,
} from "~/apis/platform/memberships/queries";
import {
  MEMBERSHIP_ROLES,
  type Membership,
  type MembershipRole,
} from "~/apis/platform/memberships/types";
import type { PlatformTenant } from "~/apis/platform/tenants/types";
import type { PlatformUserRow } from "~/apis/platform/users/types";

/** Roles a non-admin caller may assign (OWNER is admin-only on the backend). */
function assignableRoles(isAdmin: boolean): readonly MembershipRole[] {
  return isAdmin ? MEMBERSHIP_ROLES : MEMBERSHIP_ROLES.filter((r) => r !== "owner");
}

interface CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: PlatformUserRow[];
  tenants: PlatformTenant[];
  isAdmin: boolean;
}

export const CreateMembershipDialog = ({
  open,
  onOpenChange,
  users,
  tenants,
  isAdmin,
}: CreateDialogProps) => {
  const createMembership = useCreateMembership();
  const [userId, setUserId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [role, setRole] = useState<MembershipRole>("member");

  const reset = () => {
    setUserId("");
    setTenantId("");
    setRole("member");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const onSubmit = async () => {
    if (!userId || !tenantId) return;
    await createMembership.mutateAsync(
      { userId, tenantId, role },
      { onSuccess: () => handleOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add membership</DialogTitle>
          <DialogDescription>
            Assign a user to a tenant with a role.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field className="gap-1">
            <FieldLabel htmlFor="membership-user">User</FieldLabel>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger id="membership-user" className="w-full">
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
            <FieldLabel htmlFor="membership-tenant">Tenant</FieldLabel>
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger id="membership-tenant" className="w-full">
                <SelectValue placeholder="Select a tenant" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field className="gap-1">
            <FieldLabel htmlFor="membership-role">Role</FieldLabel>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as MembershipRole)}
            >
              <SelectTrigger id="membership-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assignableRoles(isAdmin).map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">
                    {r}
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
            disabled={createMembership.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={createMembership.isPending || !userId || !tenantId}
          >
            {createMembership.isPending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Adding…
              </>
            ) : (
              "Add membership"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EditRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membership: Membership | null;
  label?: string;
  isAdmin: boolean;
}

export const EditMembershipRoleDialog = ({
  open,
  onOpenChange,
  membership,
  label,
  isAdmin,
}: EditRoleDialogProps) => {
  const updateRole = useUpdateMembershipRole();
  // Initialized from the membership; the parent remounts via `key` per row.
  const [role, setRole] = useState<MembershipRole>(membership?.role ?? "member");

  const onSubmit = async () => {
    if (!membership) return;
    await updateRole.mutateAsync(
      { id: membership.id, payload: { role } },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  // OWNER may only be set/changed by admins.
  const roles = assignableRoles(isAdmin);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change role</DialogTitle>
          <DialogDescription>
            {label ? `Update the role for ${label}.` : "Update membership role."}
          </DialogDescription>
        </DialogHeader>

        <Field className="gap-1">
          <FieldLabel htmlFor="edit-membership-role">Role</FieldLabel>
          <Select
            value={role}
            onValueChange={(v) => setRole(v as MembershipRole)}
          >
            <SelectTrigger id="edit-membership-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r} value={r} className="capitalize">
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <DialogFooter className="mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateRole.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={updateRole.isPending}
          >
            {updateRole.isPending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
