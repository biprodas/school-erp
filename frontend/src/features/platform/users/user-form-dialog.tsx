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
import { Field, FieldError, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { useCreateUser, useUpdateUser } from "~/apis/platform/users/queries";
import {
  createUserSchema as createSchema,
  editUserSchema as editSchema,
  type CreateUserValues as CreateValues,
  type EditUserValues as EditValues,
} from "~/apis/platform/users/schema";
import {
  PLATFORM_ROLES,
  USER_STATUSES,
  type PlatformUserRow,
} from "~/apis/platform/users/types";

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: PlatformUserRow;
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
}

function RoleStatusFields({
  control,
}: {
  control: ReturnType<typeof useForm<CreateValues>>["control"] | ReturnType<typeof useForm<EditValues>>["control"];
}) {
  // `control` is structurally compatible for the shared fields below.
  const c = control as ReturnType<typeof useForm<CreateValues>>["control"];
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Controller
          name="role"
          control={c}
          render={({ field }) => (
            <Field className="gap-1">
              <FieldLabel htmlFor="user-role">Role</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="user-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORM_ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />
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
      </div>
      <Controller
        name="isAdmin"
        control={c}
        render={({ field }) => (
          <Field
            orientation="horizontal"
            className="items-center justify-between"
          >
            <FieldLabel htmlFor="user-admin">Platform admin</FieldLabel>
            <Switch
              id="user-admin"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          </Field>
        )}
      />
    </>
  );
}

function CreateUserForm({ onDone }: { onDone: () => void }) {
  const createUser = useCreateUser();
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "user",
      status: "active",
      isAdmin: false,
    },
  });

  const onSubmit = async (values: CreateValues) => {
    await createUser.mutateAsync(values, { onSuccess: onDone });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create platform user</DialogTitle>
        <DialogDescription>
          Add a new platform (super-admin) account.
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
          <RoleStatusFields control={form.control} />
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
  user: PlatformUserRow;
  onDone: () => void;
}) {
  const updateUser = useUpdateUser();
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: user.name,
      role: user.role,
      status: user.status,
      isAdmin: user.isAdmin,
    },
  });

  const onSubmit = async (values: EditValues) => {
    await updateUser.mutateAsync(
      { id: user.id, payload: values },
      { onSuccess: onDone },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit user</DialogTitle>
        <DialogDescription>
          Update {user.email}&apos;s role, status, and access.
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
          <RoleStatusFields control={form.control} />
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
