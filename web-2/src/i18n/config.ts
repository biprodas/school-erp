export const LOCALES = ["bn", "en"] as const

export type Locale = (typeof LOCALES)[number]

/**
 * Used when there is no `locale` cookie. English for now because the
 * marketing copy is English only; school hosts will fall back to the
 * school's `locale.language` setting instead (M1+).
 */
export const DEFAULT_LOCALE: Locale = "en"

/** Host-only cookie holding the viewer's chosen language. */
export const LOCALE_COOKIE = "locale"

export const isLocale = (value: unknown): value is Locale =>
  LOCALES.includes(value as Locale)
