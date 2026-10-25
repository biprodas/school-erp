"use client"

import { useTranslations } from "next-intl"

import { ariaFor, FormField } from "~/components/forms/form-field"
import { PasswordInput } from "~/components/forms/password-input"
import { SubmitButton } from "~/components/forms/submit-button"
import { useActionForm } from "~/components/forms/use-action-form"
import { FieldDescription } from "~/components/ui/field"

import { resetPassword } from "../actions"
import { FormAlert } from "./form-alert"
import { resetPasswordSchema } from "../schemas"

/** A new password for the account of a reset link; then back to sign in. */
export function ResetPasswordForm({
  token,
  account,
}: {
  token: string
  account: string | null
}) {
  const t = useTranslations("auth.reset")
  const ta = useTranslations("auth.activate")
  const { form, state, pending, errorOf, formProps } = useActionForm({
    schema: resetPasswordSchema,
    action: resetPassword,
    defaultValues: { password: "", confirmPassword: "" },
  })
  const passwordError = errorOf("password")
  const confirmError = errorOf("confirmPassword")

  return (
    <>
      <FormAlert state={state} />
      <form {...formProps} className="flex flex-col gap-5">
        <input type="hidden" name="token" value={token} />
        {/* Lets password managers file the new password under the account. */}
        {account && (
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={account}
            readOnly
            hidden
          />
        )}
        <FormField id="password" label={t("newPassword")} error={passwordError}>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            {...ariaFor("password", passwordError)}
            {...form.register("password")}
          />
          {!passwordError && (
            <FieldDescription>{ta("passwordHint")}</FieldDescription>
          )}
        </FormField>
        <FormField
          id="confirmPassword"
          label={t("confirmPassword")}
          error={confirmError}
        >
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            {...ariaFor("confirmPassword", confirmError)}
            {...form.register("confirmPassword")}
          />
        </FormField>
        <SubmitButton pending={pending}>{t("submit")}</SubmitButton>
      </form>
    </>
  )
}
