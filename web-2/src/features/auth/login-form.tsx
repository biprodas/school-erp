"use client"

import { useTranslations } from "next-intl"

import { ariaFor, FormField } from "~/components/form/form-field"
import { PasswordInput } from "~/components/form/password-input"
import { SubmitButton } from "~/components/form/submit-button"
import { useActionForm } from "~/components/form/use-action-form"
import { buttonVariants } from "~/components/ui/button"
import { FieldSeparator } from "~/components/ui/field"
import { Input } from "~/components/ui/input"

import { signIn } from "./actions"
import type { AuthErrorKey } from "./errors"
import { FormAlert } from "./form-alert"
import { GoogleIcon } from "./google-icon"
import { loginSchema } from "./schemas"

/**
 * One sign-in form for staff, students and guardians: email or phone and
 * password, plus "Continue with Google" when the school's host has it.
 */
export function LoginForm({
  next,
  identifier = "",
  googleHref,
  pageError,
  notice,
}: {
  next: string | null
  /** Prefilled, e.g. from the "Find your school" email's link. */
  identifier?: string
  /** `/auth/google?next=…`; null hides the button (Google not configured). */
  googleHref: string | null
  pageError: AuthErrorKey | null
  notice: string | null
}) {
  const t = useTranslations("auth.login")
  const { form, state, pending, errorOf, formProps } = useActionForm({
    schema: loginSchema,
    action: signIn,
    defaultValues: { identifier, password: "" },
  })
  const identifierError = errorOf("identifier")
  const passwordError = errorOf("password")

  return (
    <>
      <FormAlert state={state} pageError={pageError} notice={notice} />
      <form {...formProps} className="flex flex-col gap-5">
        {next && <input type="hidden" name="next" value={next} />}
        <FormField
          id="identifier"
          label={t("identifier")}
          error={identifierError}
        >
          <Input
            id="identifier"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={t("identifierPlaceholder")}
            {...ariaFor("identifier", identifierError)}
            {...form.register("identifier")}
          />
        </FormField>
        <FormField
          id="password"
          label={t("password")}
          error={passwordError}
          action={
            <a
              href="/forgot-password"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("forgot")}
            </a>
          }
        >
          <PasswordInput
            id="password"
            autoComplete="current-password"
            {...ariaFor("password", passwordError)}
            {...form.register("password")}
          />
        </FormField>
        <SubmitButton pending={pending}>{t("submit")}</SubmitButton>
      </form>
      {googleHref && (
        <>
          <FieldSeparator>{t("or")}</FieldSeparator>
          <a
            href={googleHref}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            <GoogleIcon />
            {t("google")}
          </a>
        </>
      )}
      <p className="text-sm text-muted-foreground">{t("invited")}</p>
    </>
  )
}
