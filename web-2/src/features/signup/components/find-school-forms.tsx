"use client"

import { MailCheckIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import type { FieldValues, Path, UseFormReturn } from "react-hook-form"

import { ariaFor, FormField } from "~/components/forms/form-field"
import { SubmitButton } from "~/components/forms/submit-button"
import { useActionForm } from "~/components/forms/use-action-form"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "~/components/ui/input-group"
import { FormAlert } from "~/features/auth/components/form-alert"

import { findSchoolByEmail, goToSchool } from "../actions"
import { findSchoolSchema, schoolAddressSchema } from "../schemas"

/**
 * "Enter your email": sign-in links to every school of the account.
 * After sending, "Use a different email" starts over with an empty form.
 */
export function FindByEmailForm() {
  const [attempt, setAttempt] = useState(0)
  return <EmailForm key={attempt} onRestart={() => setAttempt((n) => n + 1)} />
}

function EmailForm({ onRestart }: { onRestart: () => void }) {
  const t = useTranslations("findSchool")
  const { form, state, pending, errorOf, formProps } = useActionForm({
    schema: findSchoolSchema,
    action: findSchoolByEmail,
    defaultValues: { email: "" },
    // Errors wait for the button: the field is focused on arrival, and
    // leaving it empty to click elsewhere is not a mistake.
    mode: "onSubmit",
  })
  const emailError = errorOf("email")

  if (state.status === "success") {
    return (
      <div role="status" className="flex flex-col gap-2">
        <p className="flex items-center gap-2 font-medium">
          <MailCheckIcon className="size-5 text-primary" aria-hidden="true" />
          {t("sentTitle")}
        </p>
        <p className="text-muted-foreground">
          {t("sentBody", { email: state.email ?? "" })}
        </p>
        <Button
          variant="link"
          className="h-auto self-start p-0 underline"
          onClick={onRestart}
        >
          {t("useDifferentEmail")}
        </Button>
      </div>
    )
  }

  return (
    <>
      <FormAlert state={state} />
      <form {...formProps} className="flex flex-col gap-4">
        <FormField id="email" label={t("email")} error={emailError}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            autoCapitalize="none"
            spellCheck={false}
            // The page is this one field.
            autoFocus
            {...ariaFor("email", emailError)}
            {...quietWhileTyping(form, "email")}
          />
        </FormField>
        <SubmitButton pending={pending}>{t("emailSubmit")}</SubmitButton>
      </form>
    </>
  )
}

/** "Enter your school's address": straight to that school's sign-in page. */
export function FindByAddressForm({ rootDomain }: { rootDomain: string }) {
  const t = useTranslations("findSchool")
  const { form, state, pending, errorOf, formProps } = useActionForm({
    schema: schoolAddressSchema(rootDomain),
    action: goToSchool,
    defaultValues: { address: "" },
    // Errors wait for the button: the field is focused on arrival, and
    // leaving it empty to click elsewhere is not a mistake.
    mode: "onSubmit",
  })
  const addressError = errorOf("address")
  // No school there: point to the email lookup right in the error.
  const notFound =
    form.getFieldState("address", form.formState).error?.message ===
    "noSchoolAtAddress"

  // The server turned the address down: back to the field to fix it.
  const { setFocus } = form
  useEffect(() => {
    if (state.status === "error" && state.fieldErrors?.address) {
      setFocus("address")
    }
  }, [state, setFocus])

  return (
    <>
      <FormAlert state={state} />
      <form {...formProps} className="flex flex-col gap-4">
        <FormField
          id="address"
          label={t("address")}
          error={
            notFound
              ? t.rich("notFound", {
                  link: (chunks) => (
                    <a
                      href="/find-school/email"
                      className="rounded-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                    >
                      {chunks}
                    </a>
                  ),
                })
              : addressError
          }
        >
          <InputGroup>
            <InputGroupInput
              id="address"
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              // Phones offer "." and "/" for a pasted address, and "Go".
              inputMode="url"
              enterKeyHint="go"
              // The page is this one field.
              autoFocus
              placeholder={t("addressPlaceholder")}
              {...ariaFor("address", addressError)}
              {...quietWhileTyping(form, "address")}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>.{rootDomain}</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </FormField>
        <SubmitButton pending={pending}>{t("addressSubmit")}</SubmitButton>
      </form>
    </>
  )
}

/**
 * `register`, except that editing the field clears its error rather than
 * checking it again: a half-typed value isn't a mistake. The next check
 * waits for the button.
 */
function quietWhileTyping<Values extends FieldValues>(
  form: UseFormReturn<Values, unknown, unknown>,
  name: Path<Values>
) {
  const field = form.register(name)
  return {
    ...field,
    onChange: async (event: React.ChangeEvent<HTMLInputElement>) => {
      await field.onChange(event)
      form.clearErrors(name)
    },
  }
}
