"use client"

import { useQuery } from "@tanstack/react-query"
import { CheckIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, type FormEvent } from "react"

import {
  applyFeeHeadsTemplate,
  createFeeHead,
  deleteFeeHead,
  FEE_FREQUENCIES,
  feeHeadsQuery,
  onboardingKeys,
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

import { StepLoadFailed, StepNote } from "./step-parts"
import { WithTemplates } from "./template-steps"
import { useSetupAction } from "../use-setup-action"

const headsKey = onboardingKeys.feeHeads

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Step 6 (optional): the school's fee heads, with the common set to add in
 * one go (only the missing ones) and a form for its own. Amounts per
 * class come later, under Fees.
 */
export function FeesStep() {
  const t = useTranslations("onboarding.fees")
  const heads = useQuery(feeHeadsQuery())

  if (heads.isPending) return <Skeleton className="h-48 rounded-lg" />
  if (heads.isError) return <StepLoadFailed retry={heads.refetch} />

  return (
    <div className="flex flex-col gap-6">
      <WithTemplates>
        {(templates) => (
          <CommonHeads templates={templates} heads={heads.data} />
        )}
      </WithTemplates>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold">
            {t("yours", { count: heads.data.length })}
          </h3>
          <p className="text-sm text-muted-foreground">{t("amountsLater")}</p>
        </div>
        {heads.data.length === 0 ? (
          <StepNote tone="info">{t("empty")}</StepNote>
        ) : (
          <ul
            className="flex flex-col divide-y rounded-lg border"
            aria-label={t("listLabel")}
          >
            {heads.data.map((head) => (
              <HeadRow key={head.id} head={head} />
            ))}
          </ul>
        )}
        <AddHeadForm heads={heads.data} />
      </section>
    </div>
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
    <section
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-3 sm:p-4",
        missing === 0 && "border-primary/40 bg-primary/5"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-sm font-semibold">{t("commonTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t("commonBody")}</p>
        </div>
        {missing > 0 ? (
          <Button
            variant={heads.length ? "outline" : "default"}
            size="sm"
            className="shrink-0 self-start"
            disabled={apply.isPending}
            onClick={() => apply.mutate(undefined)}
          >
            {apply.isPending ? <Spinner /> : <PlusIcon aria-hidden />}
            {missing === items.length
              ? t("addAll", { count: missing, n: f.number(missing) })
              : t("addMissing", { count: missing, n: f.number(missing) })}
          </Button>
        ) : (
          <Badge variant="secondary" className="h-8 shrink-0 self-start px-3">
            <CheckIcon aria-hidden />
            {t("allAdded")}
          </Badge>
        )}
      </div>
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
                  ? "bg-primary text-primary-foreground"
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
    </section>
  )
}

/** One of the school's fee heads, removable until it is used. */
function HeadRow({ head }: { head: FeeHead }) {
  const t = useTranslations("onboarding.fees")
  const remove = useSetupAction({
    action: () => deleteFeeHead(head.id),
    invalidate: [headsKey],
    success: () => t("removed", { name: head.name }),
  })

  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {head.name}
      </span>
      <Badge variant="outline" className="shrink-0">
        {t(`billed.${head.frequency}`)}
      </Badge>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("remove", { name: head.name })}
        title={t("remove", { name: head.name })}
        disabled={remove.isPending}
        className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        onClick={() => remove.mutate(undefined)}
      >
        {remove.isPending ? <Spinner /> : <Trash2Icon aria-hidden />}
      </Button>
    </li>
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
      <span className="text-sm font-medium">{t("addOwn")}</span>
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
          className="sm:w-40"
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
