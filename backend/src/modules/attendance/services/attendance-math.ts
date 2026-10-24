import { WEEKDAYS, type Weekday } from '~/modules/settings/settings.types';
import { addDays } from '~/shared/dates/local-date';
import { CountsAs } from '../enums/attendance.enum';

/**
 * The arithmetic behind attendance (PRD 6.7): tallies, percentages and the
 * calendar questions (weekend, lock window). Pure, so it is unit-tested on
 * its own.
 */

/** A student's (or a group's) days by what they count as. */
export interface AttendanceTally {
  /** Days with a record (taken registers). */
  days: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  halfDay: number;
}

export const emptyTally = (): AttendanceTally => ({
  days: 0,
  present: 0,
  absent: 0,
  late: 0,
  leave: 0,
  halfDay: 0,
});

const FIELD: Record<CountsAs, keyof Omit<AttendanceTally, 'days'>> = {
  [CountsAs.PRESENT]: 'present',
  [CountsAs.ABSENT]: 'absent',
  [CountsAs.LATE]: 'late',
  [CountsAs.LEAVE]: 'leave',
  [CountsAs.HALF_DAY]: 'halfDay',
};

/** Adds `n` days of one kind to `tally` (in place) and returns it. */
export function addToTally(
  tally: AttendanceTally,
  countsAs: CountsAs,
  n = 1,
): AttendanceTally {
  tally.days += n;
  tally[FIELD[countsAs]] += n;
  return tally;
}

/** Sums tallies (class totals from sections, school from classes). */
export function sumTallies(tallies: AttendanceTally[]): AttendanceTally {
  return tallies.reduce(
    (sum, t) => ({
      days: sum.days + t.days,
      present: sum.present + t.present,
      absent: sum.absent + t.absent,
      late: sum.late + t.late,
      leave: sum.leave + t.leave,
      halfDay: sum.halfDay + t.halfDay,
    }),
    emptyTally(),
  );
}

/** Days attended: late counts as present, a half-day as half a day. */
export const attendedDays = (t: AttendanceTally): number =>
  t.present + t.late + t.halfDay / 2;

/**
 * Attendance percentage, one decimal: attended days over recorded days.
 * Leave counts as a day not attended (the school sees the leave count next
 * to it). Null when nothing was recorded.
 */
export function attendancePercentage(t: AttendanceTally): number | null {
  if (t.days === 0) return null;
  return Math.round((attendedDays(t) / t.days) * 1000) / 10;
}

/** `Weekday` of a `YYYY-MM-DD` day. */
export function weekdayOf(date: string): Weekday {
  const jsDay = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  // WEEKDAYS starts on Saturday.
  return WEEKDAYS[(jsDay + 1) % 7];
}

export const isWeekend = (date: string, weekendDays: readonly Weekday[]) =>
  weekendDays.includes(weekdayOf(date));

/** Every day from `from` to `to`, inclusive. */
export function datesBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

/**
 * Whether a day's register is past the lock window: with `lockAfterDays`
 * 7, today and the 7 days before stay open; 0 leaves only today open.
 */
export const isLocked = (date: string, today: string, lockAfterDays: number) =>
  date < addDays(today, -lockAfterDays);

/** First and last day of a `YYYY-MM` month. */
export function monthRange(month: string): { from: string; to: string } {
  const from = `${month}-01`;
  const next = new Date(`${from}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { from, to: addDays(next.toISOString().slice(0, 10), -1) };
}

/** Numeric rolls sort as numbers, others after them as text. */
export function byRoll(a: string | null, b: string | null): number {
  const na = Number(a);
  const nb = Number(b);
  if (a && b && Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return (a ?? '￿').localeCompare(b ?? '￿');
}
