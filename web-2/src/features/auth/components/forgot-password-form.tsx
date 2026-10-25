"use client"

import { MailCheckIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { ariaFor, FormField } from "~/components/forms/form-field"
import { SubmitButton } from "~/components/forms/submit-button"
import { useActionForm } from "~/components/forms/use-action-form"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"

import type { FormState } from "~/lib/forms/form-state"

import { requestPasswordReset } from "../actions"
import { FormAlert } from "./form-alert"
import { forgotPasswordSchema } from "../schemas"

type Props = {
  action?: (previous: FormState, formData: FormData) => Promise<FormState>
  host?: "school" | "admin"
}

/**
 * Asks for a reset link; the answer is the same whether or not the email
 * has an account. The admin host uses it too, with its own action: no
 * school to name and no phone-only accounts to point at the office.
 * "Send again" starts a fresh form (the action's state can't be reset).
 */
export function ForgotPasswordForm(props: Props) {
  const [attempt, setAttempt] = useState(0)
  return (
    <ForgotPasswordAttempt
      key={attempt}
      {...props}
      onRetry={() => setAttempt((n) => n + 1)}
    />
  )
}

function ForgotPasswordAttempt({
  action = requestPasswordReset,
  host = "school",
  onRetry,
}: Props & { onRetry: () => void }) {
  const t = useTranslations("auth.forgot")
  const { form, state, pending, errorOf, formProps } = useActionForm({
    schema: forgotPasswordSchema,
    action,
    defaultValues: { email: "" },
    // As on sign-in: the error waits for the button, so it can't move it.
    mode: "onSubmit",
  })
  const emailError = errorOf("email")

  if (state.status === "success") {
    return (
      <div role="status" className="flex flex-col gap-4">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheckIcon className="size-5" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1.5">
          <p className="font-medium">{t("sentTitle")}</p>
          <p className="text-muted-foreground">
            {t(host === "admin" ? "sentBodyAdmin" : "sentBody", {
              email: state.email ?? "",
            })}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">{t("sentHint")}</p>
        <Button variant="outline" size="lg" onClick={onRetry}>
          {t("sendAgain")}
        </Button>
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
            placeholder={t("emailPlaceholder")}
            {...ariaFor("email", emailError)}
            {...form.register("email")}
          />
        </FormField>
        <SubmitButton pending={pending}>{t("submit")}</SubmitButton>
      </form>
      {host === "school" && (
        <p className="text-sm text-muted-foreground">{t("phoneOnly")}</p>
      )}
    </>
  )
}
