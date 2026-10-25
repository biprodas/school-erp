/**
 * A phone number the backend accepts (`normalizePhone` in
 * `backend/src/common/identity/identifier.ts`): Bangladeshi mobile in local
 * or `+880` form, or any E.164 number. Returns the E.164 form, or null.
 */
export function normalizePhone(input: string): string | null {
  const compact = input.trim().replace(/[\s\-().]/g, "")
  const bd = /^(?:\+?880)?0?(1[3-9]\d{8})$/.exec(compact)
  if (bd) return `+880${bd[1]}`
  if (compact.startsWith("+880")) return null
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact
  return null
}
