"use client"

import { TriangleAlertIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect } from "react"

import { Button } from "~/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"

/** A page that failed to render, inside the shell, with a retry. */
export default function DashboardError({
  error,
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  const t = useTranslations("shell.error")

  useEffect(() => {
    console.error("[dashboard] page failed", error)
  }, [error])

  const digest =
    error instanceof Error && "digest" in error ? String(error.digest) : null

  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>
          <h1 className="font-display text-2xl font-semibold">{t("title")}</h1>
        </EmptyTitle>
        <EmptyDescription>{t("body")}</EmptyDescription>
        {digest && (
          <p className="font-mono text-xs text-muted-foreground">
            {t("reference", { digest })}
          </p>
        )}
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => retry()}>{t("retry")}</Button>
      </EmptyContent>
    </Empty>
  )
}
