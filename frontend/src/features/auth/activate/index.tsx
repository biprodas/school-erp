"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  useActivateAccount,
  useVerifyActivation,
} from "~/apis/tenanted/auth/queries";
import { activateSchema, type ActivateValues } from "~/apis/tenanted/auth/schema";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { TENANT_LOGIN, DEFAULT_LOGIN_REDIRECT } from "~/constants/routes";
import { signInWithCredentials } from "~/features/auth/hooks";

export default function ActivateView() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const verify = useVerifyActivation(token);
  const activate = useActivateAccount();

  const form = useForm<ActivateValues>({
    resolver: zodResolver(activateSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  if (!token) {
    return (
      <InvalidState description="This activation link is missing its token." />
    );
  }

  if (verify.isLoading) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (verify.isError || !verify.data) {
    return (
      <InvalidState description="This activation link is invalid or has expired. Ask your administrator for a new one." />
    );
  }

  const info = verify.data;

  const onSubmit = async (values: ActivateValues) => {
    try {
      await activate.mutateAsync({ token, password: values.password });
    } catch {
      toast.error("Activation failed. The link may have expired.");
      return;
    }

    // This page serves admin-invited owners who arrive via an emailed link on
    // their tenant subdomain. Sign them straight into the tenant and land on
    // the tenant dashboard.
    const result = await signInWithCredentials(
      "tenant",
      { email: info.email, password: values.password },
      info.tenant.slug,
    );
    if (!result || result.error) {
      toast.success("Account activated — please sign in.");
      router.push(TENANT_LOGIN);
      return;
    }
    toast.success("Welcome aboard!");
    router.push(DEFAULT_LOGIN_REDIRECT);
    router.refresh();
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Set your password</CardTitle>
        <CardDescription>
          Activate the account for <strong>{info.email}</strong> at{" "}
          {info.tenant.slug}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Controller
              name="password"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field className="gap-1">
                  <FieldLabel htmlFor="password">New password</FieldLabel>
                  <div className="relative">
                    <Input
                      {...field}
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      aria-invalid={fieldState.invalid}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeIcon className="size-4" />
                      ) : (
                        <EyeOffIcon className="size-4" />
                      )}
                    </button>
                  </div>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              name="confirmPassword"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field className="gap-1">
                  <FieldLabel htmlFor="confirmPassword">
                    Confirm password
                  </FieldLabel>
                  <Input
                    {...field}
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Field>
              <Button
                type="submit"
                disabled={activate.isPending || form.formState.isSubmitting}
              >
                {activate.isPending || form.formState.isSubmitting ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Activating…
                  </>
                ) : (
                  "Activate account"
                )}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

function InvalidState({ description }: { description: string }) {
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Activation link problem</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <Link href={TENANT_LOGIN}>Go to sign in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
