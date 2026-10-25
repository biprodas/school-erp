"use client"

import { MailCheckIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRef, useState } from "react"
import { flushSync } from "react-dom"
import { useWatch } from "react-hook-form"

import { ariaFor, FormField } from "~/components/forms/form-field"
import { PasswordInput } from "~/components/forms/password-input"
import { SubmitButton } from "~/components/forms/submit-button"
import { useActionForm } from "~/components/forms/use-action-form"
import { Button, buttonVariants } from "~/components/ui/button"
import { FieldDescription, FieldSeparator } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "~/components/ui/input-group"
import { Spinner } from "~/components/ui/spinner"
import { FormAlert } from "~/features/auth/components/form-alert"
import type { AuthErrorKey } from "~/features/auth/errors"
import { GoogleIcon } from "~/features/auth/components/google-icon"
import type { FormState } from "~/lib/forms/form-state"
import { slugify } from "~/lib/tenancy/slugs"
import { cn } from "~/lib/utils"

import { startSignup } from "../actions"
import { signupSchema, type SignupValues } from "../schemas"
import { SlugStatus } from "./slug-status"

/** What "Sign up with Google" verified (decoded from the ticket). */
export interface GoogleSignup {
  ticket: string
  email: string
  name: string
}

/**
 * The self-serve signup form (PRD 6.2). The address is suggested from the
 * school's name until it is edited, and checked live; it shows as one
 * line until "Change" (or an error) opens its field. The kind of
 * institution is asked in onboarding's profile step. Without Google the
 * answer is "check your email" (with resend); with Google the school is
 * created at once and the action moves the owner to it.
 */
export function SignupForm({
  rootDomain,
  initialSchoolName,
  google,
  googleHref,
  pageError,
}: {
  rootDomain: string
  initialSchoolName: string
  google: GoogleSignup | null
  /** `/signup/google`; null when Google sign-in is off or already used. */
  googleHref: string | null
  /** `?error=` from Google. */
  pageError: AuthErrorKey | null
}) {
  const t = useTranslations("signup")
  const formRef = useRef<HTMLFormElement>(null)
  const [slugEdited, setSlugEdited] = useState(false)
  const [slugOpen, setSlugOpen] = useState(false)
  const changeSlugRef = useRef<HTMLButtonElement>(null)
  /** The success the user went back from to change something. */
  const [editingAfter, setEditingAfter] = useState<FormState | null>(null)

  const defaultValues: SignupValues = {
    schoolName: initialSchoolName,
    slug: slugify(initialSchoolName),
    ownerName: google?.name ?? "",
    email: google?.email ?? "",
    password: "",
    googleTicket: google?.ticket ?? "",
  }
  const { form, state, pending, errorOf, formProps } = useActionForm({
    schema: signupSchema,
    action: startSignup,
    defaultValues,
    // A field is checked once something is typed in it; moving through
    // fields without typing isn't a mistake. The rest wait for the button.
    mode: "onChange",
  })
  const slug = useWatch({ control: form.control, name: "slug" }) ?? ""
  const email = useWatch({ control: form.control, name: "email" }) ?? ""

  const schoolName = form.register("schoolName")
  const slugField = form.register("slug")
  const errors = {
    schoolName: errorOf("schoolName"),
    slug: errorOf("slug"),
    ownerName: errorOf("ownerName"),
    email: errorOf("email"),
    password: errorOf("password"),
  }

  // An error on the address opens its field, and it stays open.
  const slugExpanded = slugOpen || !!errors.slug

  function pickSlug(value: string) {
    setSlugEdited(true)
    form.setValue("slug", value, { shouldValidate: true })
  }

  const sent = state.status === "success" && editingAfter !== state

  return (
    <>
      {sent && (
        <div role="status" className="flex flex-col gap-4">
          <p className="flex items-center gap-2 text-lg font-medium">
            <MailCheckIcon className="size-5 text-primary" aria-hidden="true" />
            {t("sentTitle")}
          </p>
          <p className="text-muted-foreground">
            {t("sentBody", { email: state.email ?? email })}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={pending}
              onClick={() => formRef.current?.requestSubmit()}
            >
              {pending && <Spinner />}
              {t("resend")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => setEditingAfter(state)}
            >
              {t("changeDetails")}
            </Button>
          </div>
        </div>
      )}

      <div hidden={sent} className="flex flex-col gap-6">
        {google ? (
          <p className="text-sm text-muted-foreground">
            {t("googleVerified", { email: google.email })}
          </p>
        ) : (
          googleHref && (
            <>
              <a
                href={googleHref}
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                <GoogleIcon />
                {t("google")}
              </a>
              <FieldSeparator>{t("or")}</FieldSeparator>
            </>
          )
        )}

        <FormAlert
          state={state.status === "error" ? state : undefined}
          pageError={pageError}
        />

        <form ref={formRef} {...formProps} className="flex flex-col gap-5">
          <input type="hidden" {...form.register("googleTicket")} />

          <fieldset className="flex flex-col gap-5">
            <legend className="mb-4 font-display text-lg font-semibold">
              {t("schoolSection")}
            </legend>
            <FormField
              id="schoolName"
              label={t("schoolName")}
              error={errors.schoolName}
            >
              <Input
                id="schoolName"
                autoComplete="organization"
                placeholder={t("schoolNamePlaceholder")}
                {...ariaFor("schoolName", errors.schoolName)}
                {...schoolName}
                onChange={(event) => {
                  void schoolName.onChange(event)
                  if (!slugEdited) {
                    form.setValue("slug", slugify(event.target.value))
                  }
                }}
              />
            </FormField>
            {/* Folded, the address reads as a line under the name. */}
            <div
              className={cn("flex flex-col gap-2", !slugExpanded && "-mt-2")}
            >
              <div
                hidden={slugExpanded}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
              >
                <span className="text-muted-foreground">{t("slugLabel")}</span>
                <span className="font-medium break-all">
                  {slug ? (
                    `${slug}.${rootDomain}`
                  ) : (
                    // A blank to fill until the school has a name.
                    <span className="text-muted-foreground">
                      <span
                        aria-hidden="true"
                        className="inline-block w-10 border-b border-current align-baseline"
                      />
                      .{rootDomain}
                    </span>
                  )}
                </span>
                <Button
                  type="button"
                  variant="link"
                  ref={changeSlugRef}
                  className="h-auto p-0"
                  aria-controls="slug-field"
                  aria-expanded={false}
                  onClick={() => {
                    // Shown first, so the field can take the focus.
                    flushSync(() => setSlugOpen(true))
                    form.setFocus("slug")
                  }}
                >
                  {t("changeSlug")}
                </Button>
              </div>
              <div id="slug-field" hidden={!slugExpanded}>
                <FormField
                  id="slug"
                  label={t("slugLabel")}
                  error={errors.slug}
                  action={
                    // Folds back into the line; with an error it stays open.
                    !errors.slug && (
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto shrink-0 p-0"
                        aria-controls="slug-field"
                        aria-expanded={true}
                        onClick={() => {
                          flushSync(() => setSlugOpen(false))
                          changeSlugRef.current?.focus()
                        }}
                      >
                        {t("slugDone")}
                      </Button>
                    )
                  }
                >
                  <InputGroup>
                    <InputGroupInput
                      id="slug"
                      placeholder={t("slugPlaceholder")}
                      autoCapitalize="none"
                      autoComplete="off"
                      spellCheck={false}
                      {...ariaFor("slug", errors.slug)}
                      {...slugField}
                      onChange={(event) => {
                        setSlugEdited(true)
                        setSlugOpen(true)
                        void slugField.onChange(event)
                      }}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>.{rootDomain}</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  {!errors.slug && (
                    <FieldDescription>{t("slugHint")}</FieldDescription>
                  )}
                </FormField>
              </div>
              <SlugStatus
                slug={slug}
                rootDomain={rootDomain}
                suggestions={
                  errors.slug && state.status === "error"
                    ? state.suggestions
                    : undefined
                }
                onPick={pickSlug}
                quiet={!slugExpanded}
              />
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-5">
            <legend className="mb-4 font-display text-lg font-semibold">
              {t("ownerSection")}
            </legend>
            <FormField
              id="ownerName"
              label={t("ownerName")}
              error={errors.ownerName}
            >
              <Input
                id="ownerName"
                autoComplete="name"
                placeholder={t("ownerNamePlaceholder")}
                {...ariaFor("ownerName", errors.ownerName)}
                {...form.register("ownerName")}
              />
            </FormField>
            <FormField id="email" label={t("email")} error={errors.email}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t("emailPlaceholder")}
                autoCapitalize="none"
                spellCheck={false}
                readOnly={!!google}
                {...ariaFor("email", errors.email)}
                {...form.register("email")}
              />
            </FormField>
            {!google && (
              <FormField
                id="password"
                label={t("password")}
                error={errors.password}
              >
                <PasswordInput
                  id="password"
                  autoComplete="new-password"
                  placeholder={t("passwordPlaceholder")}
                  {...ariaFor("password", errors.password)}
                  {...form.register("password")}
                />
                {!errors.password && (
                  <FieldDescription>{t("passwordHint")}</FieldDescription>
                )}
              </FormField>
            )}
          </fieldset>

          <SubmitButton pending={pending}>{t("submit")}</SubmitButton>
        </form>
      </div>
    </>
  )
}
