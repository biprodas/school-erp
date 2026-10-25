/**
 * The languages the product speaks (the frontend's `LOCALES`, web-2
 * `src/i18n/config.ts`). Each has a folder of translations under
 * `src/i18n/<locale>/` (nestjs-i18n) and its notification defaults.
 */
export const LOCALES = ['en', 'bn', 'hi'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** The header the frontend sets from the viewer's `locale` cookie. */
export const LOCALE_HEADER = 'x-locale';

export const isLocale = (value: unknown): value is Locale =>
  LOCALES.includes(value as Locale);
