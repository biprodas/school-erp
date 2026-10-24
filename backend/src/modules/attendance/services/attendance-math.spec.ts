import { CountsAs } from '../enums/attendance.enum';
import {
  addToTally,
  attendancePercentage,
  byRoll,
  datesBetween,
  emptyTally,
  isLocked,
  isWeekend,
  monthRange,
  sumTallies,
  weekdayOf,
} from './attendance-math';

describe('attendance math', () => {
  const tally = (counts: Partial<Record<CountsAs, number>>) => {
    const t = emptyTally();
    for (const [kind, n] of Object.entries(counts)) {
      addToTally(t, kind as CountsAs, n);
    }
    return t;
  };

  describe('attendancePercentage', () => {
    it('is null when nothing was recorded', () => {
      expect(attendancePercentage(emptyTally())).toBeNull();
    });

    it('counts late as present and a half-day as half', () => {
      const t = tally({
        [CountsAs.PRESENT]: 6,
        [CountsAs.LATE]: 2,
        [CountsAs.HALF_DAY]: 1,
        [CountsAs.ABSENT]: 1,
      });
      expect(t.days).toBe(10);
      expect(attendancePercentage(t)).toBe(85);
    });

    it('counts leave as a day not attended', () => {
      const t = tally({ [CountsAs.PRESENT]: 3, [CountsAs.LEAVE]: 1 });
      expect(attendancePercentage(t)).toBe(75);
    });

    it('rounds to one decimal', () => {
      const t = tally({ [CountsAs.PRESENT]: 2, [CountsAs.ABSENT]: 1 });
      expect(attendancePercentage(t)).toBe(66.7);
      expect(attendancePercentage(tally({ [CountsAs.PRESENT]: 1 }))).toBe(100);
      expect(attendancePercentage(tally({ [CountsAs.ABSENT]: 4 }))).toBe(0);
    });
  });

  it('sums tallies field by field', () => {
    const sum = sumTallies([
      tally({ [CountsAs.PRESENT]: 2, [CountsAs.ABSENT]: 1 }),
      tally({ [CountsAs.LATE]: 1, [CountsAs.LEAVE]: 2 }),
    ]);
    expect(sum).toEqual({
      days: 6,
      present: 2,
      absent: 1,
      late: 1,
      leave: 2,
      halfDay: 0,
    });
  });

  it('names the weekday and knows the weekend', () => {
    expect(weekdayOf('2026-10-23')).toBe('friday');
    expect(weekdayOf('2026-10-24')).toBe('saturday');
    expect(weekdayOf('2026-10-25')).toBe('sunday');
    expect(isWeekend('2026-10-23', ['friday'])).toBe(true);
    expect(isWeekend('2026-10-24', ['friday'])).toBe(false);
    expect(isWeekend('2026-10-24', ['friday', 'saturday'])).toBe(true);
  });

  it('locks days older than the window', () => {
    expect(isLocked('2026-10-17', '2026-10-24', 7)).toBe(false);
    expect(isLocked('2026-10-16', '2026-10-24', 7)).toBe(true);
    expect(isLocked('2026-10-24', '2026-10-24', 0)).toBe(false);
    expect(isLocked('2026-10-23', '2026-10-24', 0)).toBe(true);
  });

  it('lists days and months, leap years included', () => {
    expect(datesBetween('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
    expect(datesBetween('2026-01-02', '2026-01-01')).toEqual([]);
    expect(monthRange('2028-02')).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    });
    expect(monthRange('2026-12')).toEqual({
      from: '2026-12-01',
      to: '2026-12-31',
    });
  });

  it('orders rolls numerically, then text, then missing', () => {
    expect(['10', null, '2', 'B1', '1'].sort(byRoll)).toEqual([
      '1',
      '2',
      '10',
      'B1',
      null,
    ]);
  });
});
