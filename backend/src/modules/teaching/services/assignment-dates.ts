import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  FindOptionsWhere,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  Not,
} from 'typeorm';
import { addDays } from '~/shared/dates/local-date';

/** Dates of the session an assignment's section belongs to. */
export interface SessionDates {
  startDate: string | null;
  endDate: string | null;
}

/** For a section whose session can't be loaded (e.g. soft-deleted). */
export const NO_DATES: SessionDates = { startDate: null, endDate: null };

/** The columns both assignment tables share. */
export interface DatedAssignment {
  effectiveFrom: string;
  effectiveTo: string | null;
}

export const invalidDate = (message: string) =>
  new BadRequestException({ message, code: 'INVALID_EFFECTIVE_DATE' });

/** Throws unless `date` is inside the session (when it has dates). */
export function assertInSession(date: string, session: SessionDates): void {
  if (
    (session.startDate && date < session.startDate) ||
    (session.endDate && date > session.endDate)
  ) {
    throw invalidDate('The date is outside the session');
  }
}

/** The first day of a new assignment: as given, else the session's start. */
export function startOf(
  given: string | undefined,
  session: SessionDates,
  today: string,
): string {
  const from = given ?? session.startDate ?? today;
  assertInSession(from, session);
  return from;
}

/** A handover or end date defaults to today, but not before the session. */
export function changeDate(
  given: string | undefined,
  session: SessionDates,
  today: string,
): string {
  if (given) return given;
  return session.startDate && today < session.startDate
    ? session.startDate
    : today;
}

/** Ended rows are history: they can't be changed. */
export function assertCurrent(row: DatedAssignment): void {
  if (row.effectiveTo !== null) {
    throw new ConflictException({
      message: 'The assignment has ended; history rows cannot change',
      code: 'ASSIGNMENT_ENDED',
    });
  }
}

/**
 * Plan for handing a current row to someone else from `from`:
 * `repoint` when it never took effect (same first day), else `split`
 * (end the row the day before, open a new one on `from`).
 */
export function handoverPlan(
  row: DatedAssignment,
  from: string,
): { kind: 'repoint' } | { kind: 'split'; endOld: string } {
  if (from < row.effectiveFrom) {
    throw invalidDate('A handover cannot start before the assignment did');
  }
  return from === row.effectiveFrom
    ? { kind: 'repoint' }
    : { kind: 'split', endOld: addDays(from, -1) };
}

/** `where` fragments for `current` / `on` list filters. */
export function datedWhere<T extends DatedAssignment>(filter: {
  current?: boolean;
  on?: string;
}): FindOptionsWhere<T>[] {
  const base = {} as FindOptionsWhere<DatedAssignment>;
  if (filter.current === true) base.effectiveTo = IsNull();
  if (filter.current === false) base.effectiveTo = Not(IsNull());
  if (!filter.on) return [base as FindOptionsWhere<T>];
  const started = { ...base, effectiveFrom: LessThanOrEqual(filter.on) };
  if (filter.current === true) return [started as FindOptionsWhere<T>];
  const open = { ...started, effectiveTo: IsNull() };
  const closedLater = {
    ...started,
    effectiveTo: MoreThanOrEqual(filter.on),
  };
  return (
    filter.current === false ? [closedLater] : [open, closedLater]
  ) as FindOptionsWhere<T>[];
}
