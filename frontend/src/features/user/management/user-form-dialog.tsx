"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { Controller, useForm, type Control } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useTenantRoles } from "~/apis/tenanted/roles/queries";
import {
  useCreateTenantUser,
  useUpdateTenantUser,
} from "~/apis/tenanted/users/queries";
import {
  createUserSchema as createSchema,
  editUserSchema as editSchema,
  type CreateUserValues as CreateValues,
  type EditUserValues as EditValues,
} from "~/apis/tenanted/users/schema";
import { USER_STATUSES, type TenantUserRow } from "~/apis/tenanted/users/types";

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: TenantUserRow;
}

export const UserFormDialog = ({
  open,
  onOpenChange,
  user,
}: UserFormDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {user ? (
          <EditUserForm
            key={user.id}
            user={user}
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <CreateUserForm onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
};

function StatusField({
  control,
}: {
  control: Control<CreateValues> | Control<EditValues>;
}) {
  // `control` is structurally compatible for the shared `status` field.
  const c = control as Control<CreateValues>;
  return (
    <Controller
      name="status"
      control={c}
      render={({ field }) => (
        <Field className="gap-1">
          <FieldLabel htmlFor="user-status">Status</FieldLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger id="user-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {USER_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    />
  );
}

function RolesField({
  control,
}: {
  control: Control<CreateValues> | Control<EditValues>;
}) {
  const c = control as Control<CreateValues>;
  const rolesQuery = useTenantRoles();
  const roles = rolesQuery.data ?? [];

  return (
    <Controller
      name="roleIds"
      control={c}
      render={({ field }) => {
        const selected = new Set(field.value ?? []);
        const toggle = (id: string, checked: boolean) => {
          const next = new Set(selected);
          if (checked) next.add(id);
          else next.delete(id);
          field.onChange([...next]);
        };
        return (
          <Field className="gap-1">
            <FieldLabel>Roles</FieldLabel>
            {rolesQuery.isLoading ? (
              <p className="text-muted-foreground text-sm">Loading roles…</p>
            ) : roles.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No roles available.
              </p>
            ) : (
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                {roles.map((role) => (
                  <label
                    key={role.id}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={selected.has(role.id)}
                      onCheckedChange={(checked) =>
                        toggle(role.id, checked === true)
                      }
                    />
                    <span className="capitalize">{role.name}</span>
                  </label>
                ))}
              </div>
            )}
          </Field>
        );
      }}
    />
  );
}

function CreateUserForm({ onDone }: { onDone: () => void }) {
  const createUser = useCreateTenantUser();
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      status: "active",
      roleIds: [],
    },
  });

  const onSubmit = async (values: CreateValues) => {
    await createUser.mutateAsync(values, { onSuccess: onDone });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create user</DialogTitle>
        <DialogDescription>
          Add a new user to this school and assign their roles.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field className="gap-1">
                <FieldLabel htmlFor="user-name">Name</FieldLabel>
                <Input {...field} id="user-name" placeholder="Jane Doe" />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field className="gap-1">
                <FieldLabel htmlFor="user-email">Email</FieldLabel>
                <Input
                  {...field}
                  id="user-email"
                  type="email"
                  placeholder="jane@example.com"
                  autoComplete="off"
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="password"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field className="gap-1">
                <FieldLabel htmlFor="user-password">Password</FieldLabel>
                <Input
                  {...field}
                  id="user-password"
                  type="password"
                  autoComplete="new-password"
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <StatusField control={form.control} />
          <RolesField control={form.control} />
        </FieldGroup>
        <DialogFooter className="mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={onDone}
            disabled={createUser.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={createUser.isPending}>
            {createUser.isPending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create user"
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function EditUserForm({
  user,
  onDone,
}: {
  user: TenantUserRow;
  onDone: () => void;
}) {
  const updateUser = useUpdateTenantUser();
  const originalRoleIds = user.roles.map((r) => r.id);
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: user.name,
      status: user.status,
      roleIds: originalRoleIds,
    },
  });

  const onSubmit = async (values: EditValues) => {
    const original = new Set(originalRoleIds);
    const next = new Set(values.roleIds);
    const addRoleIds = values.roleIds.filter((id) => !original.has(id));
    const removeRoleIds = originalRoleIds.filter((id) => !next.has(id));

    await updateUser.mutateAsync(
      {
        id: user.id,
        payload: { name: values.name, status: values.status },
        addRoleIds,
        removeRoleIds,
      },
      { onSuccess: onDone },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit user</DialogTitle>
        <DialogDescription>
          Update {user.email}&apos;s name, status, and roles.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field className="gap-1">
                <FieldLabel htmlFor="edit-user-name">Name</FieldLabel>
                <Input {...field} id="edit-user-name" />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <StatusField control={form.control} />
          <RolesField control={form.control} />
        </FieldGroup>
        <DialogFooter className="mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={onDone}
            disabled={updateUser.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={updateUser.isPending}>
            {updateUser.isPending ? (
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
