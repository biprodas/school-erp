"use client"

import { CheckIcon, CircleIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useWatch } from "react-hook-form"

import { ariaFor, FormField } from "~/components/forms/form-field"
import { PasswordInput } from "~/components/forms/password-input"
import { SubmitButton } from "~/components/forms/submit-button"
import { useActionForm } from "~/components/forms/use-action-form"

import { activate } from "../actions"
import { FormAlert } from "./form-alert"
import {
  activateExistingSchema,
  activateNewSchema,
  PASSWORD_MIN_LENGTH,
} from "../schemas"

/**
 * Accepting an invitation. A new account chooses a password (and confirms
 * it); an account that already has its own password enters that one, so
 * the link alone never takes an account over. `account` (the email or
 * phone) goes in a hidden username field, so password managers save the
 * new password under it.
 */
export function ActivateForm({
  token,
  account = "",
  hasPassword,
}: {
  token: string
  account?: string
  hasPassword: boolean
}) {
  return hasPassword ? (
    <ExistingPasswordForm token={token} account={account} />
  ) : (
    <NewPasswordForm token={token} account={account} />
  )
}

/** The account the password is for, for password managers only. */
function UsernameField({ account }: { account: string }) {
  if (!account) return null
  return (
    <input
      type="text"
      autoComplete="username"
      value={account}
      readOnly
      tabIndex={-1}
      aria-hidden
      className="sr-only"
    />
  )
}

/** A rule the new password meets or not yet, as it is typed. */
function Check({ met, children }: { met: boolean; children: string }) {
  const t = useTranslations("auth.activate")
  return (
    <li
      className={
        met
          ? "flex items-center gap-1.5 text-primary"
          : "flex items-center gap-1.5 text-muted-foreground"
      }
    >
      {met ? (
        <CheckIcon aria-hidden className="size-3.5" strokeWidth={3} />
      ) : (
        <CircleIcon aria-hidden className="size-3.5" />
      )}
      {children}
      <span className="sr-only">{met ? t("ruleMet") : t("ruleNotMet")}</span>
    </li>
  )
}

function NewPasswordForm({
  token,
  account,
}: {
  token: string
  account: string
}) {
  const t = useTranslations("auth.activate")
  const { form, state, pending, errorOf, formProps } = useActionForm({
    schema: activateNewSchema,
    action: activate,
    defaultValues: { password: "", confirmPassword: "" },
    // The rules under the field show progress while typing; errors wait
    // for the button.
    mode: "onSubmit",
  })
  const passwordError = errorOf("password")
  const confirmError = errorOf("confirmPassword")
  const [password, confirm] = useWatch({
    control: form.control,
    name: ["password", "confirmPassword"],
  })

  return (
    <>
      <FormAlert state={state} />
      <form {...formProps} className="flex flex-col gap-5">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="mode" value="new" />
        <UsernameField account={account} />
        <FormField id="password" label={t("newPassword")} error={passwordError}>
          <PasswordInput
            id="password"
            placeholder={t("newPasswordPlaceholder")}
            autoComplete="new-password"
            aria-describedby="password-rules"
            {...ariaFor("password", passwordError)}
            {...form.register("password")}
          />
          {!passwordError && (
            <ul id="password-rules" className="text-sm">
              <Check met={(password ?? "").length >= PASSWORD_MIN_LENGTH}>
                {t("passwordHint")}
              </Check>
            </ul>
          )}
        </FormField>
        <FormField
          id="confirmPassword"
          label={t("confirmPassword")}
          error={confirmError}
        >
          <PasswordInput
            id="confirmPassword"
            placeholder={t("confirmPasswordPlaceholder")}
            autoComplete="new-password"
            {...ariaFor("confirmPassword", confirmError)}
            {...form.register("confirmPassword")}
          />
          {!confirmError && Boolean(confirm) && (
            <ul aria-live="polite" className="text-sm">
              <Check met={confirm === password}>{t("passwordsMatch")}</Check>
            </ul>
          )}
        </FormField>
        <SubmitButton pending={pending}>{t("submit")}</SubmitButton>
      </form>
    </>
  )
}

function ExistingPasswordForm({
  token,
  account,
}: {
  token: string
  account: string
}) {
  const t = useTranslations("auth.activate")
  const { form, state, pending, errorOf, formProps } = useActionForm({
    schema: activateExistingSchema,
    action: activate,
    defaultValues: { password: "" },
    mode: "onSubmit",
  })
  const passwordError = errorOf("password")

  return (
    <>
      <FormAlert state={state} />
      <form {...formProps} className="flex flex-col gap-5">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="mode" value="existing" />
        <UsernameField account={account} />
        <FormField id="password" label={t("password")} error={passwordError}>
          <PasswordInput
            id="password"
            placeholder={t("passwordPlaceholder")}
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
