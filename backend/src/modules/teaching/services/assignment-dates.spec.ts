import { IsNull, LessThanOrEqual, MoreThanOrEqual, Not } from 'typeorm';
import {
  assertInSession,
  changeDate,
  datedWhere,
  handoverPlan,
  startOf,
} from './assignment-dates';

const SESSION = { startDate: '2026-01-01', endDate: '2026-12-31' };

describe('assignment dates', () => {
  it('starts new assignments on the session start unless given', () => {
    expect(startOf(undefined, SESSION, '2026-05-05')).toBe('2026-01-01');
    expect(startOf('2026-02-01', SESSION, '2026-05-05')).toBe('2026-02-01');
    expect(() => startOf('2027-01-01', SESSION, '2026-05-05')).toThrow(
      'outside the session',
    );
  });

  it('defaults a change to today, but not before the session starts', () => {
    expect(changeDate(undefined, SESSION, '2026-05-05')).toBe('2026-05-05');
    expect(changeDate(undefined, SESSION, '2025-12-20')).toBe('2026-01-01');
    expect(changeDate('2026-07-01', SESSION, '2026-05-05')).toBe('2026-07-01');
  });

  it('accepts any day for a session without dates', () => {
    expect(() =>
      assertInSession('1999-01-01', { startDate: null, endDate: null }),
    ).not.toThrow();
  });

  it('splits a handover the day before, or re-points on the first day', () => {
    const row = { effectiveFrom: '2026-01-01', effectiveTo: null };
    expect(handoverPlan(row, '2026-03-01')).toEqual({
      kind: 'split',
      endOld: '2026-02-28',
    });
    expect(handoverPlan(row, '2026-01-01')).toEqual({ kind: 'repoint' });
    expect(() => handoverPlan(row, '2025-12-31')).toThrow();
  });

  it('builds current / on-date filters', () => {
    expect(datedWhere({})).toEqual([{}]);
    expect(datedWhere({ current: true })).toEqual([{ effectiveTo: IsNull() }]);
    expect(datedWhere({ current: false })).toEqual([
      { effectiveTo: Not(IsNull()) },
    ]);
    expect(datedWhere({ on: '2026-03-01' })).toEqual([
      { effectiveFrom: LessThanOrEqual('2026-03-01'), effectiveTo: IsNull() },
      {
        effectiveFrom: LessThanOrEqual('2026-03-01'),
        effectiveTo: MoreThanOrEqual('2026-03-01'),
      },
    ]);
  });
});
