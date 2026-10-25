import { Field, FieldError, FieldLabel } from "~/components/ui/field"

/**
 * A labelled field with its error underneath. The control (`children`)
 * gets `id`, plus `aria-invalid` and `aria-describedby={errorId(id)}`
 * when there is an error.
 */
export function FormField({
  id,
  label,
  error,
  action,
  children,
}: {
  id: string
  label: string
  error?: string
  /** Shown at the end of the label row, e.g. a "Forgot password?" link. */
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    // The border and the message carry the error; the label keeps its color.
    <Field
      data-invalid={error ? true : undefined}
      className="data-[invalid=true]:text-foreground"
    >
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {action}
      </div>
      {children}
      {error && <FieldError id={errorId(id)}>{error}</FieldError>}
    </Field>
  )
}

export const errorId = (id: string) => `${id}-error`

/** `aria-*` props for a control whose field may have an error. */
export const ariaFor = (id: string, error?: string) =>
  error
    ? { "aria-invalid": true as const, "aria-describedby": errorId(id) }
    : {}
