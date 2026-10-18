"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useCreateOrganization, useUpdateOrganization } from "~/apis/platform/organizations/queries";
import {
  createOrganizationSchema as createSchema,
  updateOrganizationSchema as editSchema,
  type CreateOrganizationValues as CreateValues,
  type UpdateOrganizationValues as EditValues,
} from "~/apis/platform/organizations/schema";
import {
  ORGANIZATION_STATUSES,
  type OwnerActivation,
  type PlatformOrganization,
} from "~/apis/platform/organizations/types";
import type { PlatformUserRow } from "~/apis/platform/users/types";

interface TenantFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided the dialog edits this tenant; otherwise it creates one. */
  tenant?: PlatformOrganization;
  /** Platform users for the optional owner select (admin-only, create mode). */
  users?: PlatformUserRow[];
  isAdmin?: boolean;
  /** Called after a create that provisioned an owner, with their activation link. */
  onOwnerActivation?: (activation: OwnerActivation) => void;
}

export const OrganizationFormDialog = ({
  open,
  onOpenChange,
  tenant,
  users = [],
  isAdmin = false,
  onOwnerActivation,
}: TenantFormDialogProps) => {
  const isEdit = Boolean(tenant);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {isEdit ? (
          <EditTenantForm
            key={tenant!.id}
            tenant={tenant!}
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <CreateTenantForm
            users={users}
            isAdmin={isAdmin}
            onDone={() => onOpenChange(false)}
            onOwnerActivation={onOwnerActivation}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateTenantForm({
  users,
  isAdmin,
  onDone,
  onOwnerActivation,
}: {
  users: PlatformUserRow[];
  isAdmin: boolean;
  onDone: () => void;
  onOwnerActivation?: (activation: OwnerActivation) => void;
}) {
  const createOrganization = useCreateOrganization();
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", slug: "", ownerUserId: "" },
  });

  const onSubmit = async (values: CreateValues) => {
    const created = await createOrganization.mutateAsync({
      name: values.name,
      slug: values.slug,
      ownerUserId:
        isAdmin && values.ownerUserId ? values.ownerUserId : undefined,
    });
    onDone();
    if (created.activation) onOwnerActivation?.(created.activation);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create organization</DialogTitle>
        <DialogDescription>
          Provisions a new school workspace.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field className="gap-1">
                <FieldLabel htmlFor="tenant-name">Name</FieldLabel>
                <Input
                  {...field}
                  id="tenant-name"
                  placeholder="Acme Secondary School"
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="slug"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field className="gap-1">
                <FieldLabel htmlFor="tenant-slug">Slug</FieldLabel>
                <Input
                  {...field}
                  id="tenant-slug"
                  placeholder="acme_secondary"
                  autoComplete="off"
                />
                <FieldDescription>
                  Lowercase letters, numbers, and underscores. Used for the
                  subdomain.
                </FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          {isAdmin && users.length > 0 ? (
            <Controller
              name="ownerUserId"
              control={form.control}
              render={({ field }) => (
                <Field className="gap-1">
                  <FieldLabel htmlFor="tenant-owner">
                    Owner (optional)
                  </FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="tenant-owner"
                      className="w-full"
                      clearable
                      hasValue={!!field.value}
                      onClear={() => field.onChange("")}
                    >
                      <SelectValue placeholder="No owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Creates an OWNER membership for this user.
                  </FieldDescription>
                </Field>
              )}
            />
          ) : null}
        </FieldGroup>
        <DialogFooter className="mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={onDone}
            disabled={createOrganization.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={createOrganization.isPending}>
            {createOrganization.isPending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create organization"
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function EditTenantForm({
  tenant,
  onDone,
}: {
  tenant: PlatformOrganization;
  onDone: () => void;
}) {
  const updateOrganization = useUpdateOrganization();
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: tenant.name,
      status: tenant.status,
    },
  });

  const onSubmit = async (values: EditValues) => {
    await updateOrganization.mutateAsync(
      {
        id: tenant.id,
        payload: {
          name: values.name,
          status: values.status,
        },
      },
      { onSuccess: onDone },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit organization</DialogTitle>
        <DialogDescription>
          Update {tenant.name}&apos;s details and status.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field className="gap-1">
                <FieldLabel htmlFor="edit-tenant-name">Name</FieldLabel>
                <Input {...field} id="edit-tenant-name" />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="status"
            control={form.control}
            render={({ field }) => (
              <Field className="gap-1">
                <FieldLabel htmlFor="edit-tenant-status">Status</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="edit-tenant-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORGANIZATION_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
        </FieldGroup>
        <DialogFooter className="mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={onDone}
            disabled={updateOrganization.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={updateOrganization.isPending}>
            {updateOrganization.isPending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
