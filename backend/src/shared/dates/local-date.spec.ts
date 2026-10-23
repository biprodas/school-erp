import { addDays, localDate } from './local-date';

describe('localDate', () => {
  it("gives the day in the school's time zone, not UTC", () => {
    // 20:30 UTC on the 24th is already the 25th in Dhaka (UTC+6).
    const at = new Date('2026-10-24T20:30:00Z');
    expect(localDate('Asia/Dhaka', at)).toBe('2026-10-25');
    expect(localDate('UTC', at)).toBe('2026-10-24');
  });
});

describe('addDays', () => {
  it('moves across month and year ends', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
