"use client"

import { MailCheckIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { ariaFor, FormField } from "~/components/forms/form-field"
import { SubmitButton } from "~/components/forms/submit-button"
import { useActionForm } from "~/components/forms/use-action-form"
import { Input } from "~/components/ui/input"

import { requestPasswordReset } from "./actions"
import { FormAlert } from "./form-alert"
import { forgotPasswordSchema } from "./schemas"

/** Asks for a reset link; the answer is the same whether or not the email has an account. */
export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgot")
  const { form, state, pending, errorOf, formProps } = useActionForm({
    schema: forgotPasswordSchema,
    action: requestPasswordReset,
    defaultValues: { email: "" },
  })
  const emailError = errorOf("email")

  if (state.status === "success") {
    return (
      <div role="status" className="flex flex-col gap-3">
        <p className="flex items-center gap-2 font-medium">
          <MailCheckIcon className="size-5 text-primary" aria-hidden="true" />
          {t("sentTitle")}
        </p>
        <p className="text-muted-foreground">
          {t("sentBody", { email: state.email ?? "" })}
        </p>
      </div>
    )
  }

  return (
    <>
      <FormAlert state={state} />
      <form {...formProps} className="flex flex-col gap-5">
        <FormField id="email" label={t("email")} error={emailError}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            {...ariaFor("email", emailError)}
            {...form.register("email")}
          />
        </FormField>
        <SubmitButton pending={pending}>{t("submit")}</SubmitButton>
      </form>
      <p className="text-sm text-muted-foreground">{t("phoneOnly")}</p>
    </>
  )
}
