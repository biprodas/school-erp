"use client"

import { CircleAlertIcon, CircleCheckIcon, InfoIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { Alert, AlertDescription } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"

/** A step form's submit button, left-aligned, full width on phones. */
export function StepActions({
  pending,
  submit,
  disabled = false,
}: {
  pending: boolean
  submit: string
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button
        type="submit"
        disabled={pending || disabled}
        aria-busy={pending || undefined}
        className="max-sm:w-full"
      >
        {pending && <Spinner />}
        {submit}
      </Button>
    </div>
  )
}

export function StepLoadFailed({ retry }: { retry: () => unknown }) {
  const t = useTranslations("onboarding")
  return (
    <Alert variant="destructive" role="alert">
      <CircleAlertIcon />
      <AlertDescription className="flex flex-col items-start gap-2">
        {t("loadFailed")}
        <Button variant="outline" size="sm" onClick={() => void retry()}>
          {t("retry")}
        </Button>
      </AlertDescription>
    </Alert>
  )
}

/** A line saying what is already there (green check) or what to know. */
export function StepNote({
  tone = "done",
  children,
}: {
  tone?: "done" | "info"
  children: React.ReactNode
}) {
  return (
    <p className="flex items-start gap-2 text-sm">
      {tone === "done" ? (
        <CircleCheckIcon
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-chart-bar"
        />
      ) : (
        <InfoIcon
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
      )}
      <span className="min-w-0">{children}</span>
    </p>
  )
}

/** "Continue" to the next step when this one needs no form. */
export function ContinueButton({ onContinue }: { onContinue: () => void }) {
  const t = useTranslations("onboarding")
  return (
    <Button variant="outline" className="self-start" onClick={onContinue}>
      {t("continue")}
    </Button>
  )
}
