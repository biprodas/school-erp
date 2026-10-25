"use client"

import { ChevronDownIcon, LanguagesIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"

import { isLocale, LOCALE_COOKIE, LOCALES } from "~/i18n/config"
import { cn } from "~/lib/utils"

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

/**
 * Picks the language (English, Bangla, Hindi). The choice is a host-only
 * cookie read by `i18n/request.ts`; refreshing re-renders server
 * components in the new language without a full reload.
 *
 * A native `<select>` laid over a ghost-button look: phones get their own
 * picker, keyboards and screen readers get a plain combobox, and the
 * sign-in pages don't carry a popover library just for this (it was
 * ~45 KB of compressed JS on every page).
 */
export function LanguageSwitch({
  compact = false,
}: {
  /** Only the icon below the `sm` breakpoint (the app header on phones). */
  compact?: boolean
}) {
  const locale = useLocale()
  const t = useTranslations("common")
  const router = useRouter()

  function switchLocale(next: string) {
    if (!isLocale(next) || next === locale) return
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`
    router.refresh()
  }

  return (
    <span
      className={cn(
        "relative inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors",
        "hover:bg-muted hover:text-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50 dark:hover:bg-muted/50",
        "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
      )}
    >
      <LanguagesIcon aria-hidden />
      <span
        lang={locale}
        aria-hidden
        className={compact ? "max-sm:sr-only" : undefined}
      >
        {t(`languages.${locale}`)}
      </span>
      <ChevronDownIcon aria-hidden className="text-muted-foreground" />
      <select
        aria-label={t("language")}
        value={locale}
        onChange={(event) => switchLocale(event.target.value)}
        className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
      >
        {LOCALES.map((option) => (
          <option key={option} value={option} lang={option}>
            {t(`languages.${option}`)}
          </option>
        ))}
      </select>
    </span>
  )
}
