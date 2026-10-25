export const LOCALES = ["en", "bn", "hi"] as const

export type Locale = (typeof LOCALES)[number]

/** Used when there is no `locale` cookie, on every host. */
export const DEFAULT_LOCALE: Locale = "en"

/** Host-only cookie holding the viewer's chosen language. */
export const LOCALE_COOKIE = "locale"

export const isLocale = (value: unknown): value is Locale =>
  LOCALES.includes(value as Locale)
