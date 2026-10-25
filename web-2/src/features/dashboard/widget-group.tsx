"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import { RotateCwIcon, TriangleAlertIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"
import { Spinner } from "~/components/ui/spinner"

/**
 * A dashboard group (school overview, my day, finance) with its own
 * loading and error states, so one failing endpoint never blanks the
 * others. Data already on screen stays while it refreshes.
 */
export function WidgetGroup<T>({
  id,
  title,
  description,
  query,
  skeleton,
  children,
}: {
  id: string
  title: string
  description?: (data: T) => string
  query: UseQueryResult<T>
  skeleton: React.ReactNode
  children: (data: T) => React.ReactNode
}) {
  const t = useTranslations("dashboard")
  const headingId = `${id}-heading`

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h2 id={headingId} className="font-display text-lg font-semibold">
          {title}
        </h2>
        {query.data && description && (
          <p className="text-sm text-muted-foreground">
            {description(query.data)}
          </p>
        )}
      </div>
      {query.data !== undefined ? (
        children(query.data)
      ) : query.isError ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-4 text-sm sm:flex-row sm:items-center"
        >
          <TriangleAlertIcon
            aria-hidden
            className="size-5 shrink-0 text-destructive"
          />
          <span className="flex-1">{t("loadFailed")}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {query.isFetching ? <Spinner /> : <RotateCwIcon />}
            {t("retry")}
          </Button>
        </div>
      ) : (
        <div aria-busy="true">{skeleton}</div>
      )}
    </section>
  )
}

/** A titled card inside a group (a chart, a list). */
export function WidgetCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>
          <h3>{title}</h3>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

/** Skeletons in the shape of a tile row and a pair of cards. */
export function GroupSkeleton({
  tiles = 3,
  cards = 2,
}: {
  tiles?: number
  cards?: number
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: tiles }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      {cards > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: cards }, (_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      )}
    </div>
  )
}
