"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { resumeOwnerActivation } from "~/apis/platform/tenants/queries";
import { activateAccount } from "~/apis/tenanted/auth/queries";
import {
  activateSchema,
  type ActivateValues,
} from "~/apis/tenanted/auth/schema";
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
import type { TenantBootstrapStatus } from "~/apis/platform/tenants/types";
import {
  ONBOARDING_COMPLETE,
  PLATFORM_LOGIN_REDIRECT,
} from "~/constants/routes";
import { usePatchOnboardingBootstrapStatus } from "~/features/onboarding/session";

interface SetupAccessStepProps {
  tenantId: string;
  tenantSlug: string;
}

/**
 * Step 3 (apex): the owner sets their school password without leaving the
 * platform host. We mint a fresh activation token for their tenant, then call
 * the tenant-scoped activate endpoint with an explicit `x-tenant-id` header.
 * We do NOT sign into the tenant — the owner stays on their platform session
 * and continues to the finish step / platform dashboard.
 */
export function SetupAccessStep({ tenantId, tenantSlug }: SetupAccessStepProps) {
  const router = useRouter();
  const patchOnboardingStatus = usePatchOnboardingBootstrapStatus();
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const minted = useRef(false);

  const form = useForm<ActivateValues>({
    resolver: zodResolver(activateSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    // React strict-mode double-invokes effects; mint only once.
    if (minted.current) return;
    minted.current = true;
    resumeOwnerActivation(tenantId)
      .then((res) => setToken(res.activation.token))
      .catch(() => setTokenError(true));
  }, [tenantId]);

  const onSubmit = async (values: ActivateValues) => {
    if (!token) return;
    try {
      const result = await activateAccount(
        { token, password: values.password },
        tenantSlug,
      );
      toast.success("Password set!");
      // Admin-bootstrapped tenants come back `completed`; self-service owners
      // get the finish step.
      const status = (result.tenant?.bootstrapStatus ??
        "owner_activated") as TenantBootstrapStatus;
      await patchOnboardingStatus(status);
      const isComplete = status === "completed";
      router.push(isComplete ? PLATFORM_LOGIN_REDIRECT : ONBOARDING_COMPLETE);
      router.refresh();
    } catch {
      toast.error("Could not set your password. Please try again.");
    }
  };

  if (tokenError) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            We couldn&apos;t start the access setup. Please refresh and try
            again.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!token) {
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

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Set up access</CardTitle>
        <CardDescription>
          Choose a password to sign in to your school workspace.
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
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
