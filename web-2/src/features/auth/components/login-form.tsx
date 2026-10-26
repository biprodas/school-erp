"use client"

import { useTranslations } from "next-intl"

import { ariaFor, FormField } from "~/components/forms/form-field"
import { PasswordInput } from "~/components/forms/password-input"
import { SubmitButton } from "~/components/forms/submit-button"
import { useActionForm } from "~/components/forms/use-action-form"
import { buttonVariants } from "~/components/ui/button"
import type { FormState } from "~/lib/forms/form-state"
import { FieldSeparator } from "~/components/ui/field"
import { Input } from "~/components/ui/input"

import { signIn } from "../actions"
import type { AuthErrorKey } from "../errors"
import { FormAlert } from "./form-alert"
import { GoogleIcon } from "./google-icon"
import { loginSchema, platformLoginSchema } from "../schemas"

/**
 * One sign-in form for staff, students and guardians: email or phone and
 * password, plus "Continue with Google" when the school's host has it.
 * The admin host uses it too, with its own action and email only. Both
 * hosts have their own `/forgot-password`.
 */
export function LoginForm({
  next,
  identifier = "",
  googleHref,
  pageError,
  notice,
  action = signIn,
  emailOnly = false,
}: {
  next: string | null
  /** Prefilled, e.g. from the "Find your school" email's link. */
  identifier?: string
  /** `/auth/google?next=…`; null hides the button (Google not configured). */
  googleHref: string | null
  pageError: AuthErrorKey | null
  notice: string | null
  action?: (previous: FormState, formData: FormData) => Promise<FormState>
  /** Email, no phone number (platform admins on the admin host). */
  emailOnly?: boolean
}) {
  const t = useTranslations("auth.login")
  const { form, state, pending, errorOf, formProps } = useActionForm({
    schema: emailOnly ? platformLoginSchema : loginSchema,
    action,
    defaultValues: { identifier, password: "" },
    // Errors wait for "Sign in": checking on blur would show one while the
    // pointer is on its way to the button and push the button down.
    mode: "onSubmit",
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
          label={t(emailOnly ? "email" : "identifier")}
          error={identifierError}
        >
          <Input
            id="identifier"
            type={emailOnly ? "email" : "text"}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={t(
              emailOnly ? "emailPlaceholder" : "identifierPlaceholder"
            )}
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
            placeholder={t("passwordPlaceholder")}
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
    </>
  )
}
