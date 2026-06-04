"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
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
import { useCreateTenant, useUpdateTenant } from "~/features/platform/management/hooks";
import {
  TENANT_STATUSES,
  type PlatformTenant,
  type PlatformUserRow,
} from "~/types/platform";

const createSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(63)
    .regex(
      /^[a-z0-9_]+$/,
      "Only lowercase letters, numbers, and underscores",
    ),
  domain: z.string().optional(),
  ownerUserId: z.string().optional(),
});

const editSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  domain: z.string().optional(),
  status: z.enum(TENANT_STATUSES),
});

type CreateValues = z.infer<typeof createSchema>;
type EditValues = z.infer<typeof editSchema>;

interface TenantFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided the dialog edits this tenant; otherwise it creates one. */
  tenant?: PlatformTenant;
  /** Platform users for the optional owner select (admin-only, create mode). */
  users?: PlatformUserRow[];
  isAdmin?: boolean;
}

export function TenantFormDialog({
  open,
  onOpenChange,
  tenant,
  users = [],
  isAdmin = false,
}: TenantFormDialogProps) {
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
}: {
  users: PlatformUserRow[];
  isAdmin: boolean;
  onDone: () => void;
}) {
  const createTenant = useCreateTenant();
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", slug: "", domain: "", ownerUserId: "" },
  });

  const onSubmit = async (values: CreateValues) => {
    await createTenant.mutateAsync(
      {
        name: values.name,
        slug: values.slug,
        domain: values.domain?.trim() ? values.domain.trim() : undefined,
        ownerUserId:
          isAdmin && values.ownerUserId ? values.ownerUserId : undefined,
      },
      { onSuccess: onDone },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create tenant</DialogTitle>
        <DialogDescription>
          Provisions a new school workspace and its database schema.
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
                  subdomain and schema.
                </FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="domain"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field className="gap-1">
                <FieldLabel htmlFor="tenant-domain">
                  Custom domain (optional)
                </FieldLabel>
                <Input
                  {...field}
                  id="tenant-domain"
                  placeholder="erp.acme.com"
                  autoComplete="off"
                />
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
                    <SelectTrigger id="tenant-owner" className="w-full">
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
            disabled={createTenant.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={createTenant.isPending}>
            {createTenant.isPending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create tenant"
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
  tenant: PlatformTenant;
  onDone: () => void;
}) {
  const updateTenant = useUpdateTenant();
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: tenant.name,
      domain: tenant.domain ?? "",
      status: tenant.status,
    },
  });

  const onSubmit = async (values: EditValues) => {
    await updateTenant.mutateAsync(
      {
        id: tenant.id,
        payload: {
          name: values.name,
          domain: values.domain?.trim() ? values.domain.trim() : undefined,
          status: values.status,
        },
      },
      { onSuccess: onDone },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit tenant</DialogTitle>
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
            name="domain"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field className="gap-1">
                <FieldLabel htmlFor="edit-tenant-domain">
                  Custom domain
                </FieldLabel>
                <Input
                  {...field}
                  id="edit-tenant-domain"
                  placeholder="erp.acme.com"
                  autoComplete="off"
                />
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
                    {TENANT_STATUSES.map((s) => (
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
            disabled={updateTenant.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={updateTenant.isPending}>
            {updateTenant.isPending ? (
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
