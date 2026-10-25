"use client"

import { LanguagesIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"

import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { isLocale, LOCALE_COOKIE, LOCALES } from "~/i18n/config"

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

/**
 * Picks the language (English, Bangla, Hindi). The choice is a host-only
 * cookie read by `i18n/request.ts`; refreshing re-renders server
 * components in the new language without a full reload.
 *
 * The design system's `NativeSelect` as a ghost button (no border or
 * fill until hovered): phones get their own picker, keyboards and screen
 * readers get a plain combobox, the options follow the system's light or
 * dark colours, and the sign-in pages don't carry a popover library just
 * for this (it was ~45 KB of compressed JS on every page).
 *
 * Browsers indent the open list by the select's left padding, so the
 * select keeps its normal padding and its own text is transparent; the
 * icon and the language name are drawn over it instead.
 */
export function LanguageSwitch() {
  const locale = useLocale()
  const t = useTranslations("common")
  const router = useRouter()

  function switchLocale(next: string) {
    if (!isLocale(next) || next === locale) return
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`
    router.refresh()
  }

  return (
    <div className="inline-grid items-center">
      <NativeSelect
        aria-label={t("language")}
        className="col-start-1 row-start-1 w-full [&_select]:cursor-pointer [&_select]:border-transparent [&_select]:bg-transparent [&_select]:text-transparent [&_select]:hover:bg-muted dark:[&_select]:bg-transparent dark:[&_select]:hover:bg-muted/50"
        value={locale}
        onChange={(event) => switchLocale(event.target.value)}
      >
        {LOCALES.map((option) => (
          <NativeSelectOption key={option} value={option} lang={option}>
            {t(`languages.${option}`)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <span
        aria-hidden
        className="pointer-events-none relative z-10 col-start-1 row-start-1 flex items-center gap-2 pr-9 pl-3 text-sm font-medium"
      >
        <LanguagesIcon className="size-4 shrink-0 text-muted-foreground" />
        <span lang={locale}>{t(`languages.${locale}`)}</span>
      </span>
    </div>
  )
}
