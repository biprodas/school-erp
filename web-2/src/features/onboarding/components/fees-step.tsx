"use client"

import { useQuery } from "@tanstack/react-query"
import { CheckIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState, type FormEvent } from "react"

import { currentSessionQuery } from "~/features/academics/api"
import {
  applyFeeHeadsTemplate,
  createFeeHead,
  deleteFeeHead,
  FEE_FREQUENCIES,
  feeHeadsQuery,
  onboardingKeys,
  updateFeeHead,
  type FeeFrequency,
  type FeeHead,
  type OnboardingTemplates,
} from "~/features/onboarding/api"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { Skeleton } from "~/components/ui/skeleton"
import { Spinner } from "~/components/ui/spinner"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { cn } from "~/lib/utils"

import { billingMonths, sessionMonthOrder } from "../steps"
import { StepLoadFailed, StepNote } from "./step-parts"
import { WithTemplates } from "./template-steps"
import { useSetupAction } from "../use-setup-action"

const headsKey = onboardingKeys.feeHeads

/**
 * A color per frequency in the month strip, so rows read apart at a
 * glance: the app's green and amber, and a blue for yearly (the palette
 * has no third hue). One-time fees have no dots.
 */
const DOT: Record<FeeFrequency, string> = {
  monthly: "bg-chart-bar",
  quarterly: "bg-highlight",
  yearly: "bg-sky-600 dark:bg-sky-400",
  one_time: "",
}

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Step 6 (optional): the school's fee heads as a year of billing (when
 * each falls due, from the session's first month), editable in place; the
 * common set to add in one go; and a form for its own. Amounts per class
 * come later, under Fees.
 */
export function FeesStep() {
  const t = useTranslations("onboarding.fees")
  const heads = useQuery(feeHeadsQuery())

  if (heads.isPending) return <Skeleton className="h-48 rounded-lg" />
  if (heads.isError) return <StepLoadFailed retry={heads.refetch} />

  return (
    <div className="flex flex-col gap-6">
      <Section
        title={t("yours", { count: heads.data.length })}
        hint={t("amountsLater")}
      >
        {heads.data.length === 0 ? (
          <StepNote tone="info">{t("empty")}</StepNote>
        ) : (
          <FeeYear heads={heads.data} />
        )}
      </Section>
      <WithTemplates>
        {(templates) => (
          <CommonHeads templates={templates} heads={heads.data} />
        )}
      </WithTemplates>
      <Section title={t("addOwn")} hint={t("addOwnHint")}>
        <AddHeadForm heads={heads.data} />
      </Section>
    </div>
  )
}

/** A heading in the left column on wide screens, ruled off from the last. */
function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string
  hint: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="border-t pt-6 first:border-t-0 first:pt-0 lg:flex">
      <div className="mb-3 flex flex-col gap-0.5 lg:mb-0 lg:w-44 lg:shrink-0 lg:pr-6">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{hint}</p>
        {action && <div className="mt-2">{action}</div>}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  )
}

/**
 * The fee heads against the school year: one row each, its frequency
 * (changeable in place) and a dot in every month it is billed, starting
 * at the session's first month. Phones keep the frequency and drop the
 * months.
 */
function FeeYear({ heads }: { heads: FeeHead[] }) {
  const t = useTranslations("onboarding.fees")
  const locale = useLocale()
  const session = useQuery(currentSessionQuery())
  const firstMonth = Number(session.data?.startDate?.slice(5, 7) ?? 1)
  const monthName = new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  })
  const months = sessionMonthOrder(firstMonth).map((m) =>
    monthName.format(new Date(Date.UTC(2026, m - 1, 1)))
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm" aria-label={t("listLabel")}>
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th
                scope="col"
                className="py-2 pr-1.5 pl-2.5 text-left font-medium sm:px-3"
              >
                {t("columnName")}
              </th>
              <th
                scope="col"
                className="px-1.5 py-2 text-left font-medium sm:px-2"
              >
                {t("frequencyLabel")}
              </th>
              <th
                scope="col"
                className="px-2 py-2 font-medium max-md:hidden"
                aria-hidden
              >
                <span className="grid grid-cols-12">
                  {months.map((m, i) => (
                    <span
                      key={i}
                      className="text-center text-[10px] font-normal"
                      title={m}
                    >
                      {/* The first letter or two: the title has the rest. */}
                      {m.slice(0, locale === "bn" ? 2 : 1)}
                    </span>
                  ))}
                </span>
              </th>
              <th scope="col" className="w-0 px-2 py-2">
                <span className="sr-only">{t("columnActions")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {heads.map((head) => (
              <FeeRow key={head.id} head={head} months={months} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground max-md:hidden">
        {(["monthly", "quarterly", "yearly"] as const).map((frequency) => (
          <span key={frequency} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn("size-2 rounded-full", DOT[frequency])}
            />
            {t(`billed.${frequency}`)}
          </span>
        ))}
      </p>
    </div>
  )
}

/**
 * One fee head: change how often it is billed, or remove it. A wrong name
 * is fixed by removing it and adding another.
 */
function FeeRow({ head, months }: { head: FeeHead; months: string[] }) {
  const t = useTranslations("onboarding.fees")
  const update = useSetupAction({
    action: (frequency: FeeFrequency) => updateFeeHead(head.id, { frequency }),
    invalidate: [headsKey],
    success: (saved) =>
      t("frequencyChanged", {
        name: saved.name,
        frequency: t(`billed.${saved.frequency}`),
      }),
  })
  const remove = useSetupAction({
    action: () => deleteFeeHead(head.id),
    invalidate: [headsKey],
    success: () => t("removed", { name: head.name }),
  })
  const billed = new Set(billingMonths(head.frequency))
  const busy = update.isPending || remove.isPending

  return (
    <tr className="align-middle">
      <td className="py-2 pr-1.5 pl-2.5 sm:px-3">
        <span className="font-medium">{head.name}</span>
      </td>
      <td className="px-1.5 py-2 sm:px-2">
        <NativeSelect
          aria-label={t("frequencyFor", { name: head.name })}
          value={head.frequency}
          disabled={busy}
          onChange={(e) => update.mutate(e.target.value as FeeFrequency)}
          size="sm"
          className="w-[6.75rem] sm:w-32"
        >
          {FEE_FREQUENCIES.map((option) => (
            <NativeSelectOption key={option} value={option}>
              {t(`billed.${option}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </td>
      <td className="px-2 py-2 max-md:hidden" aria-hidden>
        {head.frequency === "one_time" ? (
          // Not on the calendar: charged once per student, when it applies.
          <span className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
            <span className="size-2.5 shrink-0 rounded-full border-[1.5px] border-muted-foreground" />
            {t("oncePerStudent")}
          </span>
        ) : (
          <span className="grid grid-cols-12 items-center">
            {months.map((m, i) => (
              <span key={i} className="flex justify-center" title={m}>
                {billed.has(i) ? (
                  <span
                    className={cn("size-2.5 rounded-full", DOT[head.frequency])}
                  />
                ) : (
                  <span className="size-1 rounded-full bg-border" />
                )}
              </span>
            ))}
          </span>
        )}
      </td>
      <td className="py-2 pr-1 pl-0 sm:px-2">
        <span className="flex items-center justify-end">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("remove", { name: head.name })}
            title={t("remove", { name: head.name })}
            disabled={busy}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => remove.mutate(undefined)}
          >
            {remove.isPending ? <Spinner /> : <Trash2Icon aria-hidden />}
          </Button>
        </span>
      </td>
    </tr>
  )
}

/** The usual fee heads, ticked when the school has them, and one button. */
function CommonHeads({
  templates,
  heads,
}: {
  templates: OnboardingTemplates
  heads: FeeHead[]
}) {
  const t = useTranslations("onboarding.fees")
  const f = useSchoolFormat()
  const items = templates.feeHeads.items.map((item) => ({
    ...item,
    added: heads.some((h) => sameName(h.name, item.name)),
  }))
  const missing = items.filter((i) => !i.added).length
  const apply = useSetupAction({
    action: applyFeeHeadsTemplate,
    invalidate: [headsKey],
    success: ({ created }) =>
      created
        ? t("applied", { count: created, n: f.number(created) })
        : t("alreadyApplied"),
  })

  return (
    <Section
      title={t("commonTitle")}
      hint={t("commonBody")}
      action={
        missing > 0 ? (
          <Button
            variant={heads.length ? "outline" : "default"}
            size="sm"
            disabled={apply.isPending}
            onClick={() => apply.mutate(undefined)}
          >
            {apply.isPending ? <Spinner /> : <PlusIcon aria-hidden />}
            {missing === items.length
              ? t("addAll", { count: missing, n: f.number(missing) })
              : t("addMissing", { count: missing, n: f.number(missing) })}
          </Button>
        ) : (
          <Badge variant="secondary" className="h-8 px-3">
            <CheckIcon aria-hidden />
            {t("allAdded")}
          </Badge>
        )
      }
    >
      <ul className="grid gap-1.5 sm:grid-cols-2" aria-label={t("commonLabel")}>
        {items.map((item) => (
          <li
            key={item.name}
            className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-sm"
          >
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full",
                item.added
                  ? "bg-chart-bar text-primary-foreground"
                  : "border border-dashed border-muted-foreground/50"
              )}
            >
              {item.added && (
                <CheckIcon aria-hidden className="size-2.5" strokeWidth={3} />
              )}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {item.name}
              {item.added && <span className="sr-only"> ({t("added")})</span>}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {t(`frequency.${item.frequency}`)}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

/** A fee head of the school's own: name and how often it is billed. */
function AddHeadForm({ heads }: { heads: FeeHead[] }) {
  const t = useTranslations("onboarding.fees")
  const [name, setName] = useState("")
  const [frequency, setFrequency] = useState<FeeFrequency>("monthly")
  const [error, setError] = useState<string | null>(null)
  const add = useSetupAction({
    action: createFeeHead,
    invalidate: [headsKey],
    success: (created) => t("headAdded", { name: created.name }),
    onSuccess: () => setName(""),
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (heads.some((h) => sameName(h.name, trimmed))) {
      setError(t("duplicate"))
      return
    }
    setError(null)
    add.mutate({ name: trimmed, frequency })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Label htmlFor="fee-head-name" className="sr-only">
          {t("name")}
        </Label>
        <Input
          id="fee-head-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          maxLength={80}
          placeholder={t("namePlaceholder")}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "fee-head-error" : undefined}
          className="sm:max-w-xs"
        />
        <NativeSelect
          aria-label={t("frequencyLabel")}
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as FeeFrequency)}
          className="w-full sm:w-36"
        >
          {FEE_FREQUENCIES.map((option) => (
            <NativeSelectOption key={option} value={option}>
              {t(`billed.${option}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button type="submit" disabled={add.isPending || !name.trim()}>
          {add.isPending ? <Spinner /> : <PlusIcon aria-hidden />}
          {t("add")}
        </Button>
      </div>
      {error && (
        <p id="fee-head-error" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}
