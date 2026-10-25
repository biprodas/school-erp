"use client"

import { useTranslations } from "next-intl"

import { ariaFor, FormField } from "~/components/form/form-field"
import { PasswordInput } from "~/components/form/password-input"
import { SubmitButton } from "~/components/form/submit-button"
import { useActionForm } from "~/components/form/use-action-form"
import { FieldDescription } from "~/components/ui/field"

import { changePassword } from "./actions"
import { FormAlert } from "./form-alert"
import { changePasswordSchema } from "./schemas"

/**
 * Current password plus a new one. `forced`: the password was set by
 * someone else (an invite slip, an admin), and nothing else opens until it
 * is changed.
 */
export function ChangePasswordForm({
  forced,
  account,
  next,
}: {
  forced: boolean
  account: string | null
  next: string | null
}) {
  const t = useTranslations("auth.changePassword")
  const ta = useTranslations("auth.activate")
  const { form, state, pending, errorOf, formProps } = useActionForm({
    schema: changePasswordSchema,
    action: changePassword,
    defaultValues: { currentPassword: "", password: "", confirmPassword: "" },
  })
  const currentError = errorOf("currentPassword")
  const passwordError = errorOf("password")
  const confirmError = errorOf("confirmPassword")

  return (
    <>
      <FormAlert state={state} />
      <form {...formProps} className="flex flex-col gap-5">
        {next && <input type="hidden" name="next" value={next} />}
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
        <FormField
          id="currentPassword"
          label={t(forced ? "forcedCurrentPassword" : "currentPassword")}
          error={currentError}
        >
          <PasswordInput
            id="currentPassword"
            autoComplete="current-password"
            {...ariaFor("currentPassword", currentError)}
            {...form.register("currentPassword")}
          />
        </FormField>
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
