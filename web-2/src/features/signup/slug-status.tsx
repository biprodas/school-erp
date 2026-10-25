"use client"

import { useQuery } from "@tanstack/react-query"
import { CircleCheckIcon, CircleXIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { slugCheckQuery } from "~/api/public/slugs"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { useDebouncedValue } from "~/hooks/use-debounced-value"
import { isReservedSlug, isValidSlug } from "~/lib/tenancy/slugs"

/**
 * Live availability of the address being typed, under the slug field:
 * checking, free, or taken with alternatives to pick. Addresses the rules
 * already refuse are left to the field's own error.
 */
export function SlugStatus({
  slug,
  rootDomain,
  suggestions: fromServer,
  onPick,
}: {
  slug: string
  rootDomain: string
  /**
   * Alternatives from a refused submit. They win over the live answer,
   * which can be up to 30 s old.
   */
  suggestions?: string[]
  onPick: (slug: string) => void
}) {
  const t = useTranslations("signup.slug")
  const debounced = useDebouncedValue(slug, 500)
  const checkable = isValidSlug(debounced) && !isReservedSlug(debounced)
  const check = useQuery({ ...slugCheckQuery(debounced), enabled: checkable })

  const settled = debounced === slug
  let content: React.ReactNode = null
  let suggestions = fromServer ?? []
  // After a refused submit its message is on the field; only the
  // alternatives are added here.
  const live = checkable && suggestions.length === 0

  if (live && (!settled || check.isFetching)) {
    content = (
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Spinner className="size-3.5" />
        {t("checking")}
      </span>
    )
  } else if (live && check.data?.available) {
    content = (
      <span className="flex items-center gap-1.5 text-primary">
        <CircleCheckIcon className="size-4" aria-hidden="true" />
        {t("available", { host: `${slug}.${rootDomain}` })}
      </span>
    )
  } else if (live && check.data) {
    suggestions = check.data.suggestions
    content = (
      <span className="flex items-center gap-1.5 text-destructive">
        <CircleXIcon className="size-4" aria-hidden="true" />
        {t(check.data.reason === "reserved" ? "reserved" : "taken")}
      </span>
    )
  }

  return (
    <div aria-live="polite" className="flex flex-col gap-2 text-sm">
      {content}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">{t("try")}</span>
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPick(suggestion)}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
