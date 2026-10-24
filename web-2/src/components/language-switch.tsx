"use client"

import { LanguagesIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"

import { Button } from "~/components/ui/button"
import { LOCALE_COOKIE, type Locale } from "~/i18n/config"

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

/**
 * Toggles between Bangla and English. The choice is a host-only cookie read
 * by `i18n/request.ts`; refreshing re-renders server components in the new
 * language without a full reload.
 */
export function LanguageSwitch() {
  const locale = useLocale()
  const t = useTranslations("common")
  const router = useRouter()
  const other: Locale = locale === "bn" ? "en" : "bn"

  function switchLocale() {
    document.cookie = `${LOCALE_COOKIE}=${other}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`
    router.refresh()
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={switchLocale}
      aria-label={t("switchLanguage")}
      lang={other}
    >
      <LanguagesIcon />
      {t(`languages.${other}`)}
    </Button>
  )
}
