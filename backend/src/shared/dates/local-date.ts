/**
 * Business dates (`date` columns: an assignment's effective day, an
 * attendance day) are calendar days in the school's time zone, written as
 * `YYYY-MM-DD`. These helpers keep that arithmetic in one place.
 */

/** The calendar day it is at `at` in `timeZone`, e.g. `2026-10-24`. */
export function localDate(timeZone: string, at: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** `date` moved by `days` calendar days (negative goes back). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
