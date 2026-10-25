"use client"

import { MailCheckIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { ariaFor, FormField } from "~/components/form/form-field"
import { SubmitButton } from "~/components/form/submit-button"
import { useActionForm } from "~/components/form/use-action-form"
import { Input } from "~/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "~/components/ui/input-group"
import { FormAlert } from "~/features/auth/form-alert"

import { findSchoolByEmail, goToSchool } from "./actions"
import { findSchoolSchema, schoolAddressSchema } from "./schemas"

/** "Enter your email": sign-in links to every school of the account. */
export function FindByEmailForm() {
  const t = useTranslations("findSchool")
  const { form, state, pending, errorOf, formProps } = useActionForm({
    schema: findSchoolSchema,
    action: findSchoolByEmail,
    defaultValues: { email: "" },
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
            autoCapitalize="none"
            spellCheck={false}
            {...ariaFor("email", emailError)}
            {...form.register("email")}
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
  })
  const addressError = errorOf("address")

  return (
    <>
      <FormAlert state={state} />
      <form {...formProps} className="flex flex-col gap-4">
        <FormField id="address" label={t("address")} error={addressError}>
          <InputGroup>
            <InputGroupInput
              id="address"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              placeholder={t("addressPlaceholder")}
              {...ariaFor("address", addressError)}
              {...form.register("address")}
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
