/**
 * Number and money formatting for documents (PRD 6.24 localization, 8.6):
 * Bangla or Western digits by `locale.numerals`, and the South Asian
 * grouping (lakh, crore) BDT uses: 12,34,567.50.
 */

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export type Numerals = 'bn' | 'en';

/** `0-9` → `০-৯`; anything else is kept. */
export const toBanglaDigits = (text: string) =>
  text.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);

const digits = (text: string, numerals: Numerals) =>
  numerals === 'bn' ? toBanglaDigits(text) : text;

/** Groups an integer string as lakh/crore: `1234567` → `12,34,567`. */
export function groupLakh(integer: string): string {
  const negative = integer.startsWith('-');
  const n = negative ? integer.slice(1) : integer;
  if (n.length <= 3) return integer;
  const last3 = n.slice(-3);
  const rest = n.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${rest},${last3}`;
}

/**
 * Minor units as money: `123456750` → `12,34,567.50` (with Bangla digits
 * when asked). The currency code is appended when given.
 */
export function formatMoney(
  minor: number,
  options: {
    numerals?: Numerals;
    currency?: string;
    grouping?: 'lakh' | 'thousand';
  } = {},
): string {
  const negative = minor < 0;
  const abs = Math.abs(Math.round(minor));
  const integer = String(Math.floor(abs / 100));
  const fraction = String(abs % 100).padStart(2, '0');
  const grouped =
    (options.grouping ?? 'lakh') === 'lakh'
      ? groupLakh(integer)
      : integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const text = `${negative ? '-' : ''}${grouped}.${fraction}`;
  return `${digits(text, options.numerals ?? 'en')}${options.currency ? ` ${options.currency}` : ''}`;
}

/** A number (marks, GPA, counts) in the school's numerals. */
export function formatNumber(
  value: number | string | null | undefined,
  numerals: Numerals = 'en',
): string {
  if (value === null || value === undefined || value === '') return '';
  return digits(String(value), numerals);
}
