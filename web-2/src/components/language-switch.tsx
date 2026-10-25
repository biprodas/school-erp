"use client"

import { LanguagesIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"

import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { isLocale, LOCALE_COOKIE, LOCALES } from "~/i18n/config"

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

/**
 * Picks the language (English, Bangla, Hindi). The choice is a host-only
 * cookie read by `i18n/request.ts`; refreshing re-renders server
 * components in the new language without a full reload.
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

  function switchLocale(next: unknown) {
    if (!isLocale(next) || next === locale) return
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" aria-label={t("switchLanguage")} />
        }
      >
        <LanguagesIcon />
        <span lang={locale} className={compact ? "max-sm:sr-only" : undefined}>
          {t(`languages.${locale}`)}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup value={locale} onValueChange={switchLocale}>
          {LOCALES.map((option) => (
            <DropdownMenuRadioItem
              key={option}
              value={option}
              lang={option}
              closeOnClick
            >
              {t(`languages.${option}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
