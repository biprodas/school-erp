"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { Controller, useForm } from "react-hook-form";

import { useCreateTenant } from "~/apis/platform/tenants/queries";
import {
  createTenantSchema,
  type CreateTenantValues,
} from "~/apis/platform/tenants/schema";
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { ONBOARDING_ACTIVATE } from "~/constants/routes";
import { ApiError } from "~/types/api";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "lvh.me";

/** Turn a school name into a candidate subdomain slug (matches the backend rule). */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 63);
}

/**
 * Step 2 of onboarding: the signed-in owner names their school and picks a
 * subdomain. Creating the tenant makes the caller its OWNER and returns a
 * one-time activation token; we then send them to their new subdomain's
 * `/activate` page to set the tenant password (Step 3).
 */
export function CreateSchoolStep() {
  const router = useRouter();
  const createTenant = useCreateTenant();
  const slugEdited = useRef(false);

  const form = useForm<CreateTenantValues>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: { name: "", slug: "", domain: "", ownerUserId: "" },
  });

  const onSubmit = async (values: CreateTenantValues) => {
    try {
      await createTenant.mutateAsync({
        name: values.name,
        slug: values.slug,
        domain: values.domain?.trim() ? values.domain.trim() : undefined,
      });

      // Stay on the apex host: advance to the "set up access" step, which sets
      // the school password without leaving the platform.
      router.push(ONBOARDING_ACTIVATE);
    } catch (err) {
      // Surface a taken slug inline; the mutation hook already toasts.
      if (err instanceof ApiError && /slug/i.test(err.message)) {
        form.setError("slug", { message: "That subdomain is already taken" });
      }
    }
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Create your school</CardTitle>
        <CardDescription>
          Set up your school&apos;s workspace. You can change these later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field className="gap-1">
                  <FieldLabel htmlFor="school-name">School name</FieldLabel>
                  <Input
                    {...field}
                    id="school-name"
                    placeholder="Acme Secondary School"
                    autoComplete="organization"
                    onChange={(e) => {
                      field.onChange(e);
                      // Auto-suggest the slug until the user edits it directly.
                      if (!slugEdited.current) {
                        form.setValue("slug", slugify(e.target.value), {
                          shouldValidate: form.formState.isSubmitted,
                        });
                      }
                    }}
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
                  <FieldLabel htmlFor="school-slug">Subdomain</FieldLabel>
                  <Input
                    {...field}
                    id="school-slug"
                    placeholder="acme_secondary"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    onChange={(e) => {
                      slugEdited.current = true;
                      field.onChange(e);
                    }}
                  />
                  <FieldDescription>
                    Your school will be at{" "}
                    <span className="font-medium text-foreground">
                      {field.value || "your-school"}.{ROOT_DOMAIN}
                    </span>
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
                  <FieldLabel htmlFor="school-domain">
                    Custom domain (optional)
                  </FieldLabel>
                  <Input
                    {...field}
                    id="school-domain"
                    placeholder="erp.acme.com"
                    autoComplete="off"
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Field>
              <Button type="submit" disabled={createTenant.isPending}>
                {createTenant.isPending ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Creating your school…
                  </>
                ) : (
                  "Create school"
                )}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
