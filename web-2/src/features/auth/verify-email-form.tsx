"use client"

import { CircleCheckIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useActionState } from "react"

import { SubmitButton } from "~/components/forms/submit-button"
import { buttonVariants } from "~/components/ui/button"
import { IDLE } from "~/lib/forms/form-state"

import { verifyEmail } from "./actions"
import { FormAlert } from "./form-alert"

/**
 * Confirms an email address with one press. Verifying on page load would
 * let mail scanners, which open links, use the token up.
 */
export function VerifyEmailForm({
  token,
  email,
}: {
  token: string
  email: string | null
}) {
  const t = useTranslations("auth.verify")
  const [state, formAction, pending] = useActionState(verifyEmail, IDLE)

  if (state.status === "success") {
    return (
      <div role="status" className="flex flex-col gap-5">
        <p className="flex items-center gap-2 font-medium">
          <CircleCheckIcon className="size-5 text-primary" aria-hidden="true" />
          {t("doneTitle")}
        </p>
        <p className="text-muted-foreground">
          {t("doneBody", { email: state.email ?? email ?? "" })}
        </p>
        <a href="/" className={buttonVariants({ size: "lg" })}>
          {t("continue")}
        </a>
      </div>
    )
  }

  return (
    <>
      <FormAlert state={state} />
      <form action={formAction}>
        <input type="hidden" name="token" value={token} />
        <SubmitButton pending={pending}>{t("submit")}</SubmitButton>
      </form>
    </>
  )
}
