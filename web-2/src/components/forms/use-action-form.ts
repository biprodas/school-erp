"use client"

import { useTranslations } from "next-intl"
import {
  startTransition,
  useActionState,
  useEffect,
  type FormEvent,
} from "react"
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Path,
} from "react-hook-form"
import type { $ZodType } from "zod/v4/core"

import { IDLE, type FieldMessage, type FormState } from "~/lib/forms/form-state"
import { zodResolver } from "~/lib/forms/zod-resolver"

type Action = (previous: FormState, formData: FormData) => Promise<FormState>

/**
 * A react-hook-form form whose submit goes to a server action
 * (`useActionState`). The schema is checked in the browser first; the
 * action receives the form's `FormData` and checks it again. Without
 * JavaScript the form still posts to the action (progressive enhancement).
 * Field errors the action sends back are shown on their fields.
 */
export function useActionForm<Input extends FieldValues, Output>({
  schema,
  action,
  defaultValues,
}: {
  schema: $ZodType<Output, Input>
  action: Action
  defaultValues: DefaultValues<Input>
}) {
  // react-hook-form keeps errors in a mutable `formState`; the React
  // Compiler would memoize reads of it and show stale (missing) errors.
  "use no memo"
  const [state, formAction, pending] = useActionState(action, IDLE)
  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onTouched",
  })
  const tv = useTranslations("validation")

  const { setError } = form
  useEffect(() => {
    if (state.status !== "error" || !state.fieldErrors) return
    for (const [name, message] of Object.entries(state.fieldErrors)) {
      if (message) setError(name as Path<Input>, { type: "server", message })
    }
  }, [state, setError])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const element = event.currentTarget
    void form.handleSubmit(() => {
      startTransition(() => formAction(new FormData(element)))
    })(event)
  }

  /** The translated error of a field, if it has one. */
  function errorOf(name: Path<Input>): string | undefined {
    const message = form.getFieldState(name, form.formState).error?.message
    return message ? tv(message as FieldMessage) : undefined
  }

  return {
    form,
    state,
    pending,
    errorOf,
    formProps: { action: formAction, onSubmit, noValidate: true },
  }
}
