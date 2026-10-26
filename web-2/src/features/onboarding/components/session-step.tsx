"use client"

import { useQuery, type QueryKey } from "@tanstack/react-query"
import {
  CalendarHeartIcon,
  CheckIcon,
  ChevronDownIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useId, useState, type FormEvent } from "react"

import {
  academicKeys,
  createHoliday,
  createSession,
  currentSessionQuery,
  deleteHoliday,
  holidaysQuery,
  updateHoliday,
  updateSession,
  type AcademicYear,
  type Holiday,
  type HolidayInput,
} from "~/features/academics/api"
import {
  applyBdHolidays,
  type OnboardingTemplates,
} from "~/features/onboarding/api"
import { displaySettingsQuery } from "~/features/settings/api"
import { ariaFor, FormField } from "~/components/forms/form-field"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { Skeleton } from "~/components/ui/skeleton"
import { Spinner } from "~/components/ui/spinner"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { cn } from "~/lib/utils"

import {
  sessionMonths,
  sessionPresets,
  sessionYears,
  type SessionDates,
  type SessionPreset,
} from "../steps"
import { StepLoadFailed, StepNote } from "./step-parts"
import { WithTemplates } from "./template-steps"
import { useSetupAction } from "../use-setup-action"

/** Today as `YYYY-MM-DD` in the school's time zone. */
export function schoolToday(timeZone: string | undefined) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone ?? "Asia/Dhaka",
  }).format(new Date())
}

const pad = (n: number) => String(n).padStart(2, "0")

/**
 * Step 2: the current academic session, from the usual school years or
 * the school's own dates, editable afterwards. With one in place, the BD
 * government holidays that fall in it can be added too.
 */
export function SessionStep() {
  const session = useQuery(currentSessionQuery())
  if (session.isPending) return <Skeleton className="h-48 rounded-lg" />
  if (session.isError) return <StepLoadFailed retry={session.refetch} />
  return session.data ? (
    <CurrentSession session={session.data} />
  ) : (
    <NewSession />
  )
}

function NewSession() {
  const t = useTranslations("onboarding.session")
  const create = useSetupAction({
    action: createSession,
    invalidate: [academicKeys.currentSession],
    success: (year) => t("created", { name: year.name }),
  })
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      <SessionEditor
        submit={t("create")}
        pending={create.isPending}
        onSubmit={(values) => create.mutate({ ...values, isCurrent: true })}
      />
    </div>
  )
}

/** The session in place: what it is, editing it, and its holidays. */
function CurrentSession({ session }: { session: AcademicYear }) {
  const t = useTranslations("onboarding.session")
  const [editing, setEditing] = useState(false)
  const update = useSetupAction({
    action: (values: SessionDates) => updateSession(session.id, values),
    invalidate: [academicKeys.currentSession],
    success: (year) => t("updated", { name: year.name }),
    onSuccess: () => setEditing(false),
  })
  const { startDate, endDate } = session

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2 font-medium">
              {session.name}
              <Badge>
                <CheckIcon aria-hidden />
                {t("currentBadge")}
              </Badge>
            </span>
            {startDate && endDate && (
              <SessionSummary startDate={startDate} endDate={endDate} />
            )}
          </div>
          {!editing && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 self-start"
              onClick={() => setEditing(true)}
            >
              <PencilIcon aria-hidden />
              {t("edit")}
            </Button>
          )}
        </div>
        {editing && (
          <SessionEditor
            initial={{
              name: session.name,
              startDate: startDate ?? "",
              endDate: endDate ?? "",
            }}
            submit={t("save")}
            pending={update.isPending}
            onSubmit={(values) => update.mutate(values)}
            onCancel={() => setEditing(false)}
          />
        )}
      </section>
      {startDate && endDate && (
        <WithTemplates>
          {(templates) => (
            <Holidays
              session={session.name}
              startDate={startDate}
              endDate={endDate}
              templates={templates}
            />
          )}
        </WithTemplates>
      )}
    </div>
  )
}

/** "1 Jan 2026 – 31 Dec 2026 · 12 months". */
function SessionSummary({
  startDate,
  endDate,
}: {
  startDate: string
  endDate: string
}) {
  const t = useTranslations("onboarding.session")
  const f = useSchoolFormat()
  const months = sessionMonths(startDate, endDate)
  return (
    <span className="text-sm text-muted-foreground">
      {t("summary", {
        start: f.date(startDate),
        end: f.date(endDate),
        length: t("months", { count: months, n: f.number(months) }),
      })}
    </span>
  )
}

/**
 * Name and dates: one of the usual school years (dates set for you), or
 * custom dates. One choice is always marked, and the date fields show only
 * for custom; the name is editable either way. Checks the dates before
 * `onSubmit`.
 */
function SessionEditor({
  initial,
  submit,
  pending,
  onSubmit,
  onCancel,
}: {
  initial?: SessionDates
  submit: string
  pending: boolean
  onSubmit: (values: SessionDates) => void
  onCancel?: () => void
}) {
  const t = useTranslations("onboarding.session")
  const f = useSchoolFormat()
  const display = useQuery(displaySettingsQuery())
  const presets = sessionPresets(schoolToday(display.data?.locale.timeZone))
  const [values, setValues] = useState<SessionDates>(
    () => initial ?? presets[0]!.dates
  )
  // An existing session opens on the usual year it matches, else custom.
  const [choice, setChoice] = useState<SessionPreset | "custom">(
    () =>
      presets.find(
        ({ dates }) =>
          dates.startDate === values.startDate &&
          dates.endDate === values.endDate
      )?.key ?? "custom"
  )
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const presetsId = useId()
  const custom = choice === "custom"

  const set = (name: keyof SessionDates) => (value: string) =>
    setValues((current) => ({ ...current, [name]: value }))

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
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
    onSubmit({ ...values, name })
  }

  const valid =
    values.startDate && values.endDate && values.endDate > values.startDate

  return (
    <form onSubmit={onFormSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span id={presetsId} className="text-sm font-medium">
          {t("presetsLabel")}
        </span>
        <div
          role="group"
          aria-labelledby={presetsId}
          className="grid gap-2 sm:grid-cols-3"
        >
          {presets.map(({ key, dates }) => (
            <ChoiceCard
              key={key}
              chosen={choice === key}
              title={t(`presets.${key}`)}
              detail={`${f.date(dates.startDate)} – ${f.date(dates.endDate)}`}
              onChoose={() => {
                setChoice(key)
                setValues(dates)
                setErrors({})
              }}
            />
          ))}
          <ChoiceCard
            chosen={custom}
            title={t("presets.custom")}
            detail={t("customDetail")}
            // The dates start from the current ones, to adjust.
            onChoose={() => setChoice("custom")}
          />
        </div>
      </div>

      <div className={cn("grid gap-4", custom && "sm:grid-cols-3")}>
        <FormField id="session-name" label={t("name")} error={errors.name}>
          <Input
            id="session-name"
            value={values.name}
            onChange={(e) => set("name")(e.target.value)}
            maxLength={80}
            placeholder={t("namePlaceholder")}
            className={custom ? undefined : "sm:max-w-xs"}
            {...ariaFor("session-name", errors.name)}
          />
        </FormField>
        {custom && (
          <>
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
            <FormField
              id="session-end"
              label={t("endDate")}
              error={errors.endDate}
            >
              <Input
                id="session-end"
                type="date"
                value={values.endDate}
                onChange={(e) => set("endDate")(e.target.value)}
                {...ariaFor("session-end", errors.endDate)}
              />
            </FormField>
          </>
        )}
      </div>
      {valid && (
        <SessionSummary startDate={values.startDate} endDate={values.endDate} />
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
          className="max-sm:w-full"
        >
          {pending && <Spinner />}
          {submit}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            className="max-sm:w-full"
            onClick={onCancel}
          >
            {t("cancel")}
          </Button>
        )}
      </div>
    </form>
  )
}

/** One choice of school year: a card with a radio-style mark. */
function ChoiceCard({
  chosen,
  title,
  detail,
  onChoose,
}: {
  chosen: boolean
  title: string
  detail: string
  onChoose: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={chosen}
      onClick={onChoose}
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-background p-3 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/40",
        chosen && "border-primary bg-primary/5 hover:bg-primary/5"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
          chosen && "border-primary bg-primary text-primary-foreground"
        )}
      >
        {chosen && <CheckIcon className="size-2.5" strokeWidth={3} />}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{detail}</span>
      </span>
    </button>
  )
}

/**
 * Bangladesh's fixed-date government holidays that fall in the session,
 * ticked when the school has them, added in one go (per calendar year,
 * idempotent). The moon-dated ones are named for adding by hand.
 */
function Holidays({
  session,
  startDate,
  endDate,
  templates,
}: {
  session: string
  startDate: string
  endDate: string
  templates: OnboardingTemplates
}) {
  const t = useTranslations("onboarding.session")
  const locale = useLocale()
  const f = useSchoolFormat()
  const [showList, setShowList] = useState(false)
  const listId = useId()
  const existing = useQuery(holidaysQuery(startDate, endDate))
  const nameOf = (h: { name: string; nameBn: string }) =>
    locale === "bn" ? h.nameBn : h.name

  const years = sessionYears(startDate, endDate)
  const apply = useSetupAction({
    action: async () => {
      let created = 0
      for (const year of years) {
        created += (await applyBdHolidays(year)).created
      }
      return created
    },
    invalidate: [academicKeys.holidays(startDate, endDate)],
    success: (created) =>
      created
        ? t("holidaysAdded", { count: created, n: f.number(created) })
        : t("holidaysAlready"),
  })

  if (existing.isPending) return <Skeleton className="h-28 rounded-lg" />
  if (existing.isError) return <StepLoadFailed retry={existing.refetch} />

  const holidays = years
    .flatMap((year) =>
      templates.holidays.fixed.map((h) => ({
        ...h,
        date: `${year}-${pad(h.month)}-${pad(h.day)}`,
      }))
    )
    .filter((h) => h.date >= startDate && h.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((h) => ({
      ...h,
      added: existing.data.some(
        (e) =>
          e.dateFrom === h.date &&
          e.name.trim().toLowerCase() === h.name.trim().toLowerCase()
      ),
    }))
  const missing = holidays.filter((h) => !h.added).length
  const movable = templates.holidays.movable.map(nameOf)
  const listKey = academicKeys.holidays(startDate, endDate)

  return (
    <div className="flex flex-col gap-6">
      <section
        className={cn(
          "flex flex-col gap-3 rounded-lg border p-3 sm:p-4",
          holidays.length > 0 &&
            missing === 0 &&
            "border-primary/40 bg-primary/5"
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="text-sm font-semibold">{t("holidaysTitle")}</h3>
            <p className="text-sm text-muted-foreground">{t("holidaysBody")}</p>
          </div>
          {missing > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 self-start"
              disabled={apply.isPending}
              onClick={() => apply.mutate(undefined)}
            >
              {apply.isPending ? (
                <Spinner />
              ) : (
                <CalendarHeartIcon aria-hidden />
              )}
              {t("holidaysAction", { count: missing, n: f.number(missing) })}
            </Button>
          ) : (
            holidays.length > 0 && (
              <Badge
                variant="secondary"
                className="h-8 shrink-0 self-start px-3"
              >
                <CheckIcon aria-hidden />
                {t("holidaysAll")}
              </Badge>
            )
          )}
        </div>

        {holidays.length > 0 && (
          <>
            <button
              type="button"
              aria-expanded={showList}
              aria-controls={listId}
              onClick={() => setShowList(!showList)}
              className="flex items-center gap-1 self-start rounded-sm text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {showList ? t("hideHolidays") : t("showHolidays")}
              <ChevronDownIcon
                aria-hidden
                className={cn(
                  "size-4 transition-transform",
                  showList && "rotate-180"
                )}
              />
            </button>
            <div id={listId} hidden={!showList}>
              {showList && (
                <ul
                  className="grid gap-1.5 sm:grid-cols-2"
                  aria-label={t("holidaysLabel", { session })}
                >
                  {holidays.map((h) => (
                    <li
                      key={`${h.date}:${h.name}`}
                      className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-sm"
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-full",
                          h.added
                            ? "bg-primary text-primary-foreground"
                            : "border border-dashed border-muted-foreground/50"
                        )}
                      >
                        {h.added && (
                          <CheckIcon
                            aria-hidden
                            className="size-2.5"
                            strokeWidth={3}
                          />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {nameOf(h)}
                        {h.added && (
                          <span className="sr-only">
                            {" "}
                            ({t("holidayAdded")})
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {f.date(h.date)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold">
            {t("yourHolidays", { session })}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("yourHolidaysBody")}
          </p>
        </div>
        {existing.data.length === 0 ? (
          <StepNote tone="info">{t("noHolidays")}</StepNote>
        ) : (
          <ul
            className="flex flex-col divide-y rounded-lg border"
            aria-label={t("yourHolidays", { session })}
          >
            {[...existing.data]
              .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom))
              .map((holiday) => (
                <HolidayRow
                  key={holiday.id}
                  holiday={holiday}
                  listKey={listKey}
                />
              ))}
          </ul>
        )}
        {movable.length > 0 && (
          <StepNote tone="info">
            {t("holidaysMovable", { names: movable.join(", ") })}
          </StepNote>
        )}
        <AddHoliday listKey={listKey} defaultDate={startDate} />
      </section>
    </div>
  )
}

const HOLIDAY_TYPES: Holiday["type"][] = ["public", "religious", "school"]

/** One of the school's holidays: what and when, edited in place or removed. */
function HolidayRow({
  holiday,
  listKey,
}: {
  holiday: Holiday
  listKey: QueryKey
}) {
  const t = useTranslations("onboarding.session")
  const locale = useLocale()
  const f = useSchoolFormat()
  const [editing, setEditing] = useState(false)
  const name = (locale === "bn" && holiday.nameBn) || holiday.name
  const update = useSetupAction({
    action: (values: HolidayInput) => updateHoliday(holiday.id, values),
    invalidate: [listKey],
    success: (saved) => t("holidaySaved", { name: saved.name }),
    onSuccess: () => setEditing(false),
  })
  const remove = useSetupAction({
    action: () => deleteHoliday(holiday.id),
    invalidate: [listKey],
    success: () => t("holidayRemoved", { name }),
  })

  if (editing) {
    return (
      <li className="p-3">
        <HolidayForm
          idPrefix={`holiday-${holiday.id}`}
          initial={{
            name: holiday.name,
            type: holiday.type,
            dateFrom: holiday.dateFrom,
            dateTo: holiday.dateTo,
          }}
          submit={t("save")}
          pending={update.isPending}
          onSubmit={(values) => update.mutate(values)}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{name}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {holiday.dateTo !== holiday.dateFrom
            ? t("dateRange", {
                from: f.date(holiday.dateFrom),
                to: f.date(holiday.dateTo),
              })
            : f.date(holiday.dateFrom)}
        </span>
      </span>
      <Badge variant="outline" className="shrink-0 max-sm:hidden">
        {t(`holidayTypes.${holiday.type}`)}
      </Badge>
      <span className="flex shrink-0 items-center">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("editHoliday", { name })}
          title={t("editHoliday", { name })}
          disabled={remove.isPending}
          className="text-muted-foreground"
          onClick={() => setEditing(true)}
        >
          <PencilIcon aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("removeHoliday", { name })}
          title={t("removeHoliday", { name })}
          disabled={remove.isPending}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={() => remove.mutate(undefined)}
        >
          {remove.isPending ? <Spinner /> : <Trash2Icon aria-hidden />}
        </Button>
      </span>
    </li>
  )
}

/** A holiday of the school's own, such as Eid once its date is known. */
function AddHoliday({
  listKey,
  defaultDate,
}: {
  listKey: QueryKey
  defaultDate: string
}) {
  const t = useTranslations("onboarding.session")
  const [open, setOpen] = useState(false)
  const create = useSetupAction({
    action: createHoliday,
    invalidate: [listKey],
    success: (created) => t("holidayCreated", { name: created.name }),
    onSuccess: () => setOpen(false),
  })

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => setOpen(true)}
      >
        <PlusIcon aria-hidden />
        {t("addHoliday")}
      </Button>
    )
  }
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <h4 className="text-sm font-medium">{t("addHoliday")}</h4>
      <HolidayForm
        idPrefix="holiday-new"
        initial={{
          name: "",
          type: "religious",
          dateFrom: defaultDate,
          dateTo: "",
        }}
        submit={t("add")}
        pending={create.isPending}
        onSubmit={(values) => create.mutate(values)}
        onCancel={() => setOpen(false)}
      />
    </div>
  )
}

/** Name, kind and dates of a holiday; "to" may stay empty for one day. */
function HolidayForm({
  idPrefix,
  initial,
  submit,
  pending,
  onSubmit,
  onCancel,
}: {
  idPrefix: string
  initial: {
    name: string
    type: Holiday["type"]
    dateFrom: string
    dateTo: string
  }
  submit: string
  pending: boolean
  onSubmit: (values: HolidayInput) => void
  onCancel: () => void
}) {
  const t = useTranslations("onboarding.session")
  // A one-day holiday keeps "to" empty, so it follows a changed "from".
  const [values, setValues] = useState(() => ({
    ...initial,
    dateTo: initial.dateTo === initial.dateFrom ? "" : initial.dateTo,
  }))
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const id = (field: string) => `${idPrefix}-${field}`

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = values.name.trim()
    const next: Partial<Record<string, string>> = {}
    if (!name) next.name = t("nameRequired")
    if (!values.dateFrom) next.dateFrom = t("dateRequired")
    if (values.dateTo && values.dateFrom && values.dateTo < values.dateFrom) {
      next.dateTo = t("endAfterStart")
    }
    setErrors(next)
    if (Object.keys(next).length) return
    onSubmit({
      name,
      type: values.type,
      dateFrom: values.dateFrom,
      dateTo: values.dateTo || values.dateFrom,
    })
  }

  return (
    <form onSubmit={onFormSubmit} noValidate className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FormField id={id("name")} label={t("holidayName")} error={errors.name}>
          <Input
            id={id("name")}
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            maxLength={120}
            placeholder={t("holidayNamePlaceholder")}
            {...ariaFor(id("name"), errors.name)}
          />
        </FormField>
        <FormField id={id("type")} label={t("holidayType")}>
          <NativeSelect
            id={id("type")}
            className="w-full"
            value={values.type}
            onChange={(e) =>
              setValues({ ...values, type: e.target.value as Holiday["type"] })
            }
          >
            {HOLIDAY_TYPES.map((type) => (
              <NativeSelectOption key={type} value={type}>
                {t(`holidayTypes.${type}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FormField>
        <FormField
          id={id("from")}
          label={t("holidayFrom")}
          error={errors.dateFrom}
        >
          <Input
            id={id("from")}
            type="date"
            value={values.dateFrom}
            onChange={(e) => setValues({ ...values, dateFrom: e.target.value })}
            {...ariaFor(id("from"), errors.dateFrom)}
          />
        </FormField>
        <FormField id={id("to")} label={t("holidayTo")} error={errors.dateTo}>
          <Input
            id={id("to")}
            type="date"
            value={values.dateTo}
            min={values.dateFrom || undefined}
            onChange={(e) => setValues({ ...values, dateTo: e.target.value })}
            {...ariaFor(id("to"), errors.dateTo)}
          />
        </FormField>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          className="max-sm:w-full"
        >
          {pending && <Spinner />}
          {submit}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          className="max-sm:w-full"
          onClick={onCancel}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  )
}
