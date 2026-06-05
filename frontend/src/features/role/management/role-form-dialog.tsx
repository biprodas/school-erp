"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { useTenantPermissionCatalog } from "~/apis/tenanted/permissions/queries";
import type { PermissionGroup } from "~/apis/tenanted/permissions/types";
import {
  useCreateRole,
  useUpdateRole,
} from "~/apis/tenanted/roles/queries";
import { roleSchema, type RoleValues } from "~/apis/tenanted/roles/schema";
import type { TenantRole } from "~/apis/tenanted/roles/types";

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: TenantRole;
}

export const RoleFormDialog = ({
  open,
  onOpenChange,
  role,
}: RoleFormDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <RoleForm
          key={role?.id ?? "new"}
          role={role}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};

function PermissionMatrix({
  groups,
  value,
  onChange,
}: {
  groups: PermissionGroup[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const selected = new Set(value);
  const allKeys = groups.flatMap((g) => g.permissions.map((p) => p.key));
  const allChecked = allKeys.length > 0 && allKeys.every((k) => selected.has(k));

  const setKeys = (keys: string[], checked: boolean) => {
    const next = new Set(selected);
    for (const key of keys) {
      if (checked) next.add(key);
      else next.delete(key);
    }
    onChange([...next]);
  };

  return (
    <Field className="gap-2">
      <div className="flex items-center justify-between">
        <FieldLabel>Permissions</FieldLabel>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={allChecked}
            onCheckedChange={(checked) => setKeys(allKeys, checked === true)}
          />
          Select all
        </label>
      </div>
      <div className="max-h-72 space-y-4 overflow-y-auto rounded-md border p-3">
        {groups.map((group) => {
          const groupKeys = group.permissions.map((p) => p.key);
          const groupAll = groupKeys.every((k) => selected.has(k));
          return (
            <div key={group.resource} className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={groupAll}
                  onCheckedChange={(checked) =>
                    setKeys(groupKeys, checked === true)
                  }
                />
                <span className="capitalize">{group.resource}</span>
              </label>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 pl-6 sm:grid-cols-3">
                {group.permissions.map((perm) => (
                  <label
                    key={perm.key}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={selected.has(perm.key)}
                      onCheckedChange={(checked) =>
                        setKeys([perm.key], checked === true)
                      }
                    />
                    <span className="capitalize">{perm.action}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Field>
  );
}

function RoleForm({
  role,
  onDone,
}: {
  role?: TenantRole;
  onDone: () => void;
}) {
  const isEdit = Boolean(role);
  const isSystem = Boolean(role?.isSystem);
  const catalogQuery = useTenantPermissionCatalog();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const isPending = createRole.isPending || updateRole.isPending;

  const form = useForm<RoleValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: role?.name ?? "",
      description: role?.description ?? "",
      permissions: role?.permissions ?? [],
    },
  });

  const onSubmit = async (values: RoleValues) => {
    const payload = {
      description: values.description?.trim() ? values.description : undefined,
      permissions: values.permissions,
    };

    if (isEdit && role) {
      await updateRole.mutateAsync(
        {
          id: role.id,
          // System roles can't be renamed — omit name to avoid a 403.
          payload: isSystem ? payload : { name: values.name, ...payload },
        },
        { onSuccess: onDone },
      );
    } else {
      await createRole.mutateAsync(
        { name: values.name, ...payload },
        { onSuccess: onDone },
      );
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit role" : "Create role"}</DialogTitle>
        <DialogDescription>
          {isSystem
            ? "This is a system role — its name is fixed, but you can adjust its description and permissions."
            : "Define a role and the permissions it grants."}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field className="gap-1">
                <FieldLabel htmlFor="role-name">Name</FieldLabel>
                <Input
                  {...field}
                  id="role-name"
                  placeholder="e.g. Receptionist"
                  disabled={isSystem}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="description"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field className="gap-1">
                <FieldLabel htmlFor="role-description">Description</FieldLabel>
                <Textarea
                  {...field}
                  id="role-description"
                  rows={2}
                  placeholder="What is this role for?"
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="permissions"
            control={form.control}
            render={({ field }) =>
              catalogQuery.isLoading ? (
                <p className="text-muted-foreground text-sm">
                  Loading permissions…
                </p>
              ) : (
                <PermissionMatrix
                  groups={catalogQuery.data ?? []}
                  value={field.value}
                  onChange={field.onChange}
                />
              )
            }
          />
        </FieldGroup>
        <DialogFooter className="mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={onDone}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Saving…
              </>
            ) : isEdit ? (
              "Save changes"
            ) : (
              "Create role"
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
