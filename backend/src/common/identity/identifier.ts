/**
 * Login identifiers. A global account has an email, a phone, or both
 * (PRD 5.1); both are stored normalized so lookups are exact matches.
 */

export type Identifier = { email: string } | { phone: string };

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * E.164 form of a phone number, or null when it isn't one we accept.
 * Bangladesh mobiles may be typed locally (`01712345678`), with the country
 * code (`8801712345678`, `+880 1712-345678`), including the common
 * `+880 01712…` mix of both; other countries need the full
 * `+<country><number>` form. Any other `+880…` is rejected rather than
 * accepted as a generic international number.
 */
export function normalizePhone(input: string): string | null {
  const compact = input.trim().replace(/[\s\-().]/g, '');
  const bd = /^(?:\+?880)?0?(1[3-9]\d{8})$/.exec(compact);
  if (bd) return `+880${bd[1]}`;
  if (compact.startsWith('+880')) return null;
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact;
  return null;
}

/**
 * Reads what a user typed into "Email or phone": anything with an `@` is an
 * email, everything else must be a phone number.
 */
export function parseIdentifier(input: string): Identifier | null {
  const value = input.trim();
  if (!value) return null;
  if (value.includes('@')) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ? { email: normalizeEmail(value) }
      : null;
  }
  const phone = normalizePhone(value);
  return phone ? { phone } : null;
}
