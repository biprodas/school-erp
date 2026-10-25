"use client"

import { useTranslations } from "next-intl"
import { useActionState, useState } from "react"

import { ariaFor, FormField } from "~/components/form/form-field"
import { SubmitButton } from "~/components/form/submit-button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "~/components/ui/input-group"
import { FormAlert } from "~/features/auth/form-alert"
import { IDLE } from "~/lib/forms/form-state"

import { verifySignup } from "./actions"
import { SlugStatus } from "./slug-status"

/**
 * Creates the school from the emailed link, with one press (verifying on
 * page load would let mail scanners, which open links, use it up). When
 * the address was taken in the meantime, asks for another.
 */
export function VerifySignupForm({
  token,
  rootDomain,
}: {
  token: string
  rootDomain: string
}) {
  const t = useTranslations("signup")
  const tv = useTranslations("validation")
  const [state, formAction, pending] = useActionState(verifySignup, IDLE)
  const [slug, setSlug] = useState("")

  const slugMessage =
    state.status === "error" ? state.fieldErrors?.slug : undefined
  const needsSlug = !!slugMessage || slug !== ""
  const slugError = slugMessage ? tv(slugMessage) : undefined

  return (
    <>
      <FormAlert state={state} />
      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="token" value={token} />
        {needsSlug && (
          <FormField id="slug" label={t("newSlugLabel")} error={slugError}>
            <InputGroup>
              <InputGroupInput
                id="slug"
                name="slug"
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                value={slug}
                onChange={(event) => setSlug(event.target.value.toLowerCase())}
                {...ariaFor("slug", slugError)}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>.{rootDomain}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <SlugStatus
              slug={slug}
              rootDomain={rootDomain}
              suggestions={
                slugError && state.status === "error"
                  ? state.suggestions
                  : undefined
              }
              onPick={setSlug}
            />
          </FormField>
        )}
        <SubmitButton pending={pending}>{t("createSchool")}</SubmitButton>
      </form>
    </>
  )
}
