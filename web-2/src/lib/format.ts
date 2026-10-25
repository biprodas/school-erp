import { TZDate } from "@date-fns/tz"
import { format as formatWithPattern } from "date-fns"
import { bn } from "date-fns/locale/bn"
import { hi } from "date-fns/locale/hi"

/**
 * Numbers, money and dates as people read them (PRD 6.24, 8.6): Bangla or
 * Western digits by the school's `locale.numerals`, South Asian grouping
 * (lakh, crore) for BDT, and dates in the school's time zone and format.
 *
 * Mirrors `backend/src/shared/locale/format.ts`, so screens and PDFs agree.
 * Done by hand rather than with `Intl` because `bn-BD` output differs
 * between Node and browser ICU builds, which would break hydration.
 */

export type Numerals = "bn" | "en"

/** `locale.dateFormat` values (`DATE_FORMATS` in the backend settings). */
export type DateFormat =
  "DD/MM/YYYY" | "DD-MM-YYYY" | "YYYY-MM-DD" | "D MMM YYYY"

export const DEFAULT_TIME_ZONE = "Asia/Dhaka"
export const DEFAULT_DATE_FORMAT: DateFormat = "DD/MM/YYYY"

/**
 * Date options for the page's language: Bangla digits and month names in
 * Bangla, Hindi month names with Western digits in Hindi, else English.
 */
export const dateOptionsFor = (
  locale: string
): Pick<DateOptions, "language" | "numerals"> =>
  locale === "bn"
    ? { language: "bn", numerals: "bn" }
    : { language: locale === "hi" ? "hi" : "en", numerals: "en" }

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"]

/** `0-9` → `০-৯`; anything else is kept. */
export const toBanglaDigits = (text: string) =>
  text.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)])

const digits = (text: string, numerals: Numerals) =>
  numerals === "bn" ? toBanglaDigits(text) : text

/** Groups an integer string as lakh/crore: `1234567` → `12,34,567`. */
export function groupLakh(integer: string): string {
  const negative = integer.startsWith("-")
  const n = negative ? integer.slice(1) : integer
  if (n.length <= 3) return integer
  const last3 = n.slice(-3)
  const rest = n.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")
  return `${negative ? "-" : ""}${rest},${last3}`
}

const groupThousand = (integer: string) =>
  integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",")

export type Grouping = "lakh" | "thousand" | "none"

const group = (integer: string, grouping: Grouping) =>
  grouping === "lakh"
    ? groupLakh(integer)
    : grouping === "thousand"
      ? groupThousand(integer)
      : integer

export interface MoneyOptions {
  numerals?: Numerals
  grouping?: Grouping
  /** Prefix `৳` (the default) or nothing. */
  symbol?: boolean
  /** Drop `.00` for whole amounts (tiles); off by default (tables). */
  trimZeroFraction?: boolean
}

/**
 * Minor units (poisha, as the API sends them) as money:
 * `123456750` → `৳12,34,567.50`.
 */
export function formatMoney(
  minor: number | null | undefined,
  options: MoneyOptions = {}
): string {
  if (minor === null || minor === undefined || Number.isNaN(minor)) return ""
  const negative = minor < 0
  const abs = Math.abs(Math.round(minor))
  const integer = group(
    String(Math.floor(abs / 100)),
    options.grouping ?? "lakh"
  )
  const fraction = String(abs % 100).padStart(2, "0")
  const amount =
    options.trimZeroFraction && fraction === "00"
      ? integer
      : `${integer}.${fraction}`
  const symbol = (options.symbol ?? true) ? "৳" : ""
  return digits(
    `${negative ? "-" : ""}${symbol}${amount}`,
    options.numerals ?? "en"
  )
}

/**
 * A number (counts, marks, GPA, percentages) in the school's numerals.
 * Integer parts are grouped (lakh by default); decimals are kept as given.
 */
export function formatNumber(
  value: number | string | null | undefined,
  options: { numerals?: Numerals; grouping?: Grouping } = {}
): string {
  if (value === null || value === undefined || value === "") return ""
  const text = String(value)
  const match = /^(-?)(\d+)(\.\d+)?$/.exec(text)
  const grouped = match
    ? `${match[1]}${group(match[2], options.grouping ?? "lakh")}${match[3] ?? ""}`
    : text
  return digits(grouped, options.numerals ?? "en")
}

/** `YYYY-MM-DD` (business dates such as attendance days, due dates). */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

const PATTERNS: Record<DateFormat, string> = {
  "DD/MM/YYYY": "dd/MM/yyyy",
  "DD-MM-YYYY": "dd-MM-yyyy",
  "YYYY-MM-DD": "yyyy-MM-dd",
  "D MMM YYYY": "d MMM yyyy",
}

export interface DateOptions {
  format?: DateFormat
  timeZone?: string
  numerals?: Numerals
  /** Language of month names (`D MMM YYYY`) and AM/PM. */
  language?: "bn" | "en" | "hi"
}

/**
 * A calendar date. Date-only strings (`2026-10-24`) are business dates and
 * are shown as written, never shifted by a time zone; timestamps are shown
 * as the date in `timeZone` (Asia/Dhaka by default).
 */
export function formatDate(
  value: string | Date | null | undefined,
  options: DateOptions = {}
): string {
  const date = toZonedDate(value, options.timeZone)
  if (!date) return ""
  return render(date, PATTERNS[options.format ?? DEFAULT_DATE_FORMAT], options)
}

/** A timestamp as date and time (`24/10/2026 3:05 PM`) in `timeZone`. */
export function formatDateTime(
  value: string | Date | null | undefined,
  options: DateOptions = {}
): string {
  const date = toZonedDate(value, options.timeZone)
  if (!date) return ""
  const pattern = `${PATTERNS[options.format ?? DEFAULT_DATE_FORMAT]} h:mm a`
  return render(date, pattern, options)
}

function toZonedDate(
  value: string | Date | null | undefined,
  timeZone = DEFAULT_TIME_ZONE
): Date | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "string") {
    const dateOnly = DATE_ONLY.exec(value)
    if (dateOnly) {
      const [, y, m, d] = dateOnly
      return new Date(Number(y), Number(m) - 1, Number(d))
    }
  }
  const instant = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(instant.getTime())) return null
  return new TZDate(instant, timeZone)
}

const DATE_LOCALES = { bn, hi, en: undefined }

function render(date: Date, pattern: string, options: DateOptions): string {
  const text = formatWithPattern(date, pattern, {
    locale: DATE_LOCALES[options.language ?? "en"],
  })
  return digits(text, options.numerals ?? "en")
}
