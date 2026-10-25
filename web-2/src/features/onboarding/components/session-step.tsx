"use client"

import { useQuery } from "@tanstack/react-query"
import { CalendarHeartIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState, type FormEvent } from "react"

import {
  academicKeys,
  createSession,
  currentSessionQuery,
  type AcademicYear,
} from "~/features/academics/api"
import { applyBdHolidays } from "~/features/onboarding/api"
import { displaySettingsQuery } from "~/features/settings/api"
import { ariaFor, FormField } from "~/components/forms/form-field"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Skeleton } from "~/components/ui/skeleton"
import { Spinner } from "~/components/ui/spinner"
import { useSchoolFormat } from "~/features/settings/use-school-format"

import { defaultSession } from "../steps"
import {
  ContinueButton,
  StepActions,
  StepLoadFailed,
  StepNote,
} from "./step-parts"
import { useSetupAction } from "../use-setup-action"

/** Today as `YYYY-MM-DD` in the school's time zone. */
export function schoolToday(timeZone: string | undefined) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone ?? "Asia/Dhaka",
  }).format(new Date())
}

/**
 * Step 2: the current academic session. With one in place, the BD
 * government holidays for its first year can be added too.
 */
export function SessionStep({ onContinue }: { onContinue: () => void }) {
  const session = useQuery(currentSessionQuery())
  if (session.isPending) return <Skeleton className="h-48 rounded-lg" />
  if (session.isError) return <StepLoadFailed retry={session.refetch} />
  return session.data ? (
    <CurrentSession session={session.data} onContinue={onContinue} />
  ) : (
    <SessionForm />
  )
}

function CurrentSession({
  session,
  onContinue,
}: {
  session: AcademicYear
  onContinue: () => void
}) {
  const t = useTranslations("onboarding.session")
  const f = useSchoolFormat()
  return (
    <div className="flex flex-col gap-4">
      <StepNote>
        {session.startDate && session.endDate
          ? t("current", {
              name: session.name,
              start: f.date(session.startDate),
              end: f.date(session.endDate),
            })
          : t("currentNoDates", { name: session.name })}
      </StepNote>
      <HolidaysAction
        year={Number((session.startDate ?? schoolToday(undefined)).slice(0, 4))}
      />
      <ContinueButton onContinue={onContinue} />
    </div>
  )
}

/** After it is created, the step shows it with the holidays action. */
function SessionForm() {
  const t = useTranslations("onboarding.session")
  const display = useQuery(displaySettingsQuery())
  const [values, setValues] = useState(() =>
    defaultSession(schoolToday(display.data?.locale.timeZone))
  )
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const create = useSetupAction({
    action: createSession,
    invalidate: [academicKeys.currentSession],
    success: (year) => t("created", { name: year.name }),
  })

  const set = (name: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [name]: value }))

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = values.name.trim()
    const next: Partial<Record<string, string>> = {}
    if (!name) next.name = t("nameRequired")
    if (!values.startDate) next.startDate = t("dateRequired")
    if (!values.endDate) next.endDate = t("dateRequired")
    else if (values.startDate && values.endDate <= values.startDate) {
      next.endDate = t("endAfterStart")
    }
    setErrors(next)
    if (Object.keys(next).length) return
    create.mutate({ ...values, name, isCurrent: true })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id="session-name" label={t("name")} error={errors.name}>
          <Input
            id="session-name"
            value={values.name}
            onChange={(e) => set("name")(e.target.value)}
            maxLength={80}
            {...ariaFor("session-name", errors.name)}
          />
        </FormField>
        <FormField
          id="session-start"
          label={t("startDate")}
          error={errors.startDate}
        >
          <Input
            id="session-start"
            type="date"
            value={values.startDate}
            onChange={(e) => set("startDate")(e.target.value)}
            {...ariaFor("session-start", errors.startDate)}
          />
        </FormField>
        <FormField id="session-end" label={t("endDate")} error={errors.endDate}>
          <Input
            id="session-end"
            type="date"
            value={values.endDate}
            onChange={(e) => set("endDate")(e.target.value)}
            {...ariaFor("session-end", errors.endDate)}
          />
        </FormField>
      </div>
      <StepActions pending={create.isPending} submit={t("create")} />
    </form>
  )
}

/** Adds Bangladesh's fixed-date government holidays (idempotent). */
function HolidaysAction({ year }: { year: number }) {
  const t = useTranslations("onboarding.session")
  const locale = useLocale()
  const f = useSchoolFormat()
  const [toConfirm, setToConfirm] = useState<string[] | null>(null)
  const apply = useSetupAction({
    action: () => applyBdHolidays(year),
    success: (result) =>
      result.created
        ? t("holidaysAdded", {
            count: result.created,
            n: f.number(result.created),
          })
        : t("holidaysAlready"),
    onSuccess: (result) =>
      setToConfirm(
        result.toConfirm.map((h) => (locale === "bn" ? h.nameBn : h.name))
      ),
  })

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <p className="text-sm font-medium">
        {t("holidaysTitle", { year: f.plain(year) })}
      </p>
      <p className="text-sm text-muted-foreground">{t("holidaysBody")}</p>
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        disabled={apply.isPending}
        onClick={() => apply.mutate(undefined)}
      >
        {apply.isPending ? <Spinner /> : <CalendarHeartIcon />}
        {t("holidaysAction")}
      </Button>
      {toConfirm && toConfirm.length > 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("holidaysToConfirm", { names: toConfirm.join(", ") })}
        </p>
      )}
    </div>
  )
}
