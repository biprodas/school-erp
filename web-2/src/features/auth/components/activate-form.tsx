"use client"

import { useTranslations } from "next-intl"

import { ariaFor, FormField } from "~/components/forms/form-field"
import { PasswordInput } from "~/components/forms/password-input"
import { SubmitButton } from "~/components/forms/submit-button"
import { useActionForm } from "~/components/forms/use-action-form"
import { FieldDescription } from "~/components/ui/field"

import { activate } from "../actions"
import { FormAlert } from "./form-alert"
import { activateExistingSchema, activateNewSchema } from "../schemas"

/**
 * Accepting an invitation. A new account chooses a password (and confirms
 * it); an account that already has its own password enters that one, so
 * the link alone never takes an account over.
 */
export function ActivateForm({
  token,
  hasPassword,
}: {
  token: string
  hasPassword: boolean
}) {
  return hasPassword ? (
    <ExistingPasswordForm token={token} />
  ) : (
    <NewPasswordForm token={token} />
  )
}

function NewPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth.activate")
  const { form, state, pending, errorOf, formProps } = useActionForm({
    schema: activateNewSchema,
    action: activate,
    defaultValues: { password: "", confirmPassword: "" },
  })
  const passwordError = errorOf("password")
  const confirmError = errorOf("confirmPassword")

  return (
    <>
      <FormAlert state={state} />
      <form {...formProps} className="flex flex-col gap-5">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="mode" value="new" />
        <FormField id="password" label={t("newPassword")} error={passwordError}>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            {...ariaFor("password", passwordError)}
            {...form.register("password")}
          />
          {!passwordError && (
            <FieldDescription>{t("passwordHint")}</FieldDescription>
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

function ExistingPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth.activate")
  const { form, state, pending, errorOf, formProps } = useActionForm({
    schema: activateExistingSchema,
    action: activate,
    defaultValues: { password: "" },
  })
  const passwordError = errorOf("password")

  return (
    <>
      <FormAlert state={state} />
      <form {...formProps} className="flex flex-col gap-5">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="mode" value="existing" />
        <FormField id="password" label={t("password")} error={passwordError}>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            {...ariaFor("password", passwordError)}
            {...form.register("password")}
          />
        </FormField>
        <SubmitButton pending={pending}>{t("existingSubmit")}</SubmitButton>
      </form>
    </>
  )
}
