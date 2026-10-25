"use client"

import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import { Alert, AlertDescription } from "~/components/ui/alert"
import type { FormState } from "~/lib/forms/form-state"

import { authErrorMessage, type AuthErrorKey } from "../errors"

/**
 * The form-level message: the action's error (unless it belongs to one
 * field), or an error or notice passed in by the page (`?error=`, …).
 */
export function FormAlert({
  state,
  pageError,
  notice,
}: {
  state?: FormState
  pageError?: AuthErrorKey | null
  notice?: string | null
}) {
  const t = useTranslations("authErrors")
  const locale = useLocale()

  let error: string | null = null
  if (state?.status === "error" && !state.fieldErrors) {
    error = authErrorMessage(t, state, locale)
  } else if (state?.status !== "error" && pageError) {
    error = t(pageError)
  }

  if (error) {
    return (
      <Alert variant="destructive" aria-live="polite">
        <CircleAlertIcon />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }
  if (notice) {
    return (
      <Alert role="status">
        <CircleCheckIcon />
        <AlertDescription>{notice}</AlertDescription>
      </Alert>
    )
  }
  return null
}
