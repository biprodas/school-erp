import { DiscountKind, FeeFrequency, FineKind } from '../enums/fee.enum';
import {
  agingBucket,
  allocate,
  AllocationError,
  billsIn,
  daysBetween,
  discountsFor,
  dueDateFor,
  fineFor,
  lineOutstanding,
  percentOf,
  periodsBetween,
  type LineBalance,
} from './fee-math';

/** A small seeded PRNG, so the property runs are reproducible. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const allocationCode = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as AllocationError).code;
  }
  return null;
};

describe('[fee-regression] fee math', () => {
  describe('discounts', () => {
    it('takes a percentage in basis points, rounded down', () => {
      expect(percentOf(150_000, 1000)).toBe(15_000); // 10% of 1500.00
      expect(percentOf(99_999, 3333)).toBe(33_329);
    });

    it('adds discounts on the full amount, capped at it', () => {
      const r = discountsFor(200_000, [
        { id: 'sibling', kind: DiscountKind.PERCENT, value: 2500 },
        { id: 'staff', kind: DiscountKind.FIXED, value: 30_000 },
      ]);
      expect(r).toEqual({
        total: 80_000,
        parts: [
          { id: 'sibling', amount: 50_000 },
          { id: 'staff', amount: 30_000 },
        ],
      });
      const capped = discountsFor(100_000, [
        { id: 'merit', kind: DiscountKind.PERCENT, value: 7500 },
        { id: 'ff', kind: DiscountKind.PERCENT, value: 5000 },
      ]);
      expect(capped).toEqual({
        total: 100_000,
        parts: [
          { id: 'merit', amount: 75_000 },
          { id: 'ff', amount: 25_000 },
        ],
      });
    });
  });

  describe('billing schedule', () => {
    const session = { startPeriod: '2026-01', endPeriod: '2026-12' };

    it('bills monthly heads every month of the session only', () => {
      expect(billsIn(FeeFrequency.MONTHLY, null, '2026-07', session)).toBe(
        true,
      );
      expect(billsIn(FeeFrequency.MONTHLY, null, '2027-01', session)).toBe(
        false,
      );
    });

    it('bills quarterly heads every third month and yearly ones once', () => {
      const quarters = periodsBetween('2026-01', '2026-12').filter((p) =>
        billsIn(FeeFrequency.QUARTERLY, null, p, session),
      );
      expect(quarters).toEqual(['2026-01', '2026-04', '2026-07', '2026-10']);
      const yearly = periodsBetween('2026-01', '2026-12').filter((p) =>
        billsIn(FeeFrequency.YEARLY, null, p, session),
      );
      expect(yearly).toEqual(['2026-01']);
    });

    it('follows the months an item lists', () => {
      const exams = periodsBetween('2026-01', '2026-12').filter((p) =>
        billsIn(FeeFrequency.ONE_TIME, [6, 11], p, session),
      );
      expect(exams).toEqual(['2026-06', '2026-11']);
    });

    it('lists periods across a year end and dates the due day', () => {
      expect(periodsBetween('2026-11', '2027-02')).toEqual([
        '2026-11',
        '2026-12',
        '2027-01',
        '2027-02',
      ]);
      expect(dueDateFor('2026-02', 31)).toBe('2026-02-28');
      expect(dueDateFor('2026-03', 10)).toBe('2026-03-10');
    });
  });

  describe('late fines', () => {
    const fixed = {
      kind: FineKind.FIXED,
      amount: 5000,
      graceDays: 10,
      maxAmount: null,
    };
    const daily = {
      kind: FineKind.PER_DAY,
      amount: 1000,
      graceDays: 5,
      maxAmount: 20_000,
    };

    it('waits out the grace period', () => {
      expect(fineFor(fixed, '2026-03-10', '2026-03-20')).toBe(0);
      expect(fineFor(fixed, '2026-03-10', '2026-03-21')).toBe(5000);
      expect(fineFor(fixed, '2026-03-10', '2026-06-01')).toBe(5000);
    });

    it('grows per day up to the cap', () => {
      expect(fineFor(daily, '2026-03-10', '2026-03-15')).toBe(0);
      expect(fineFor(daily, '2026-03-10', '2026-03-18')).toBe(3000);
      expect(fineFor(daily, '2026-03-10', '2026-05-01')).toBe(20_000);
      expect(daysBetween('2026-02-27', '2026-03-01')).toBe(2);
    });
  });

  describe('allocation', () => {
    const lines = [
      { id: 'mar', outstanding: 150_000, dueDate: '2026-03-10', order: 0 },
      { id: 'jan', outstanding: 150_000, dueDate: '2026-01-10', order: 0 },
      { id: 'jan-lab', outstanding: 20_000, dueDate: '2026-01-10', order: 1 },
      { id: 'paid', outstanding: 0, dueDate: '2025-12-10', order: 0 },
    ];

    it('settles the oldest due first and leaves a precise remainder', () => {
      expect(allocate(200_000, lines)).toEqual([
        { lineId: 'jan', amount: 150_000 },
        { lineId: 'jan-lab', amount: 20_000 },
        { lineId: 'mar', amount: 30_000 },
      ]);
    });

    it('takes the accountant’s split as given', () => {
      expect(
        allocate(50_000, lines, [
          { lineId: 'mar', amount: 30_000 },
          { lineId: 'jan-lab', amount: 20_000 },
        ]),
      ).toEqual([
        { lineId: 'mar', amount: 30_000 },
        { lineId: 'jan-lab', amount: 20_000 },
      ]);
    });

    it('refuses over-allocation of the payment or of a line', () => {
      expect(allocationCode(() => allocate(400_000, lines))).toBe(
        'PAYMENT_EXCEEDS_DUE',
      );
      expect(
        allocationCode(() =>
          allocate(10_000, lines, [{ lineId: 'jan', amount: 20_000 }]),
        ),
      ).toBe('ALLOCATION_EXCEEDS_PAYMENT');
      expect(
        allocationCode(() =>
          allocate(30_000, lines, [
            { lineId: 'jan-lab', amount: 15_000 },
            { lineId: 'jan-lab', amount: 15_000 },
          ]),
        ),
      ).toBe('ALLOCATION_EXCEEDS_LINE');
      expect(
        allocationCode(() =>
          allocate(30_000, lines, [{ lineId: 'mar', amount: 20_000 }]),
        ),
      ).toBe('PAYMENT_NOT_ALLOCATED');
      expect(
        allocationCode(() =>
          allocate(10, lines, [{ lineId: 'nope', amount: 10 }]),
        ),
      ).toBe('UNKNOWN_LINE');
    });
  });

  it('buckets dues by age', () => {
    expect([0, 1, 30, 31, 60, 61, 90, 91].map(agingBucket)).toEqual([
      'current',
      '0-30',
      '0-30',
      '31-60',
      '31-60',
      '61-90',
      '61-90',
      '90+',
    ]);
  });

  /**
   * PRD 6.10's invariants over random histories of billing, payments
   * (with allocation), reversals, waivers and refunds:
   * - billed − discounts − adjustments − (collected − refunded) = outstanding
   * - each line: outstanding = net − adjusted − allocated + refunded, never < 0
   *   (a refund raises both `adjusted` and `refunded`)
   * - no allocation exceeds its payment or its line.
   */
  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    'keeps the outstanding invariants (seed %i)',
    (seed) => {
      const rand = rng(seed);
      const int = (n: number) => Math.floor(rand() * n);
      type Line = LineBalance & {
        id: string;
        amount: number;
        discount: number;
        dueDate: string;
      };
      const lines: Line[] = [];
      const payments: {
        id: string;
        amount: number;
        parts: { lineId: string; amount: number }[];
        reversed: boolean;
      }[] = [];
      let billed = 0;
      let discounts = 0;
      let adjustments = 0;
      let collected = 0;
      let refunded = 0;

      for (let step = 0; step < 300; step++) {
        const action = int(5);
        if (action === 0 || lines.length === 0) {
          const amount = 1000 + int(200_000);
          const { total } = discountsFor(amount, [
            { id: 'd', kind: DiscountKind.PERCENT, value: int(5000) },
          ]);
          lines.push({
            id: `l${lines.length}`,
            amount,
            discount: total,
            net: amount - total,
            adjusted: 0,
            allocated: 0,
            refunded: 0,
            dueDate: `2026-${String(1 + int(12)).padStart(2, '0')}-10`,
          });
          billed += amount;
          discounts += total;
        } else if (action === 1) {
          const due = lines.reduce((n, l) => n + lineOutstanding(l), 0);
          if (!due) continue;
          const amount = 1 + int(due);
          const parts = allocate(
            amount,
            lines.map((l, i) => ({
              id: l.id,
              outstanding: lineOutstanding(l),
              dueDate: l.dueDate,
              order: i,
            })),
          );
          expect(parts.reduce((n, p) => n + p.amount, 0)).toBe(amount);
          for (const p of parts)
            lines.find((l) => l.id === p.lineId)!.allocated += p.amount;
          payments.push({
            id: `p${payments.length}`,
            amount,
            parts,
            reversed: false,
          });
          collected += amount;
        } else if (action === 2) {
          const live = payments.filter((p) => !p.reversed);
          if (!live.length) continue;
          const p = live[int(live.length)];
          // A reversal only releases what a refund hasn't already returned.
          const releasable = p.parts.every((part) => {
            const l = lines.find((x) => x.id === part.lineId)!;
            return l.allocated - l.refunded >= part.amount;
          });
          if (!releasable) continue;
          for (const part of p.parts)
            lines.find((l) => l.id === part.lineId)!.allocated -= part.amount;
          p.reversed = true;
          collected -= p.amount;
        } else if (action === 3) {
          const l = lines[int(lines.length)];
          const room = lineOutstanding(l);
          if (room <= 0) continue;
          const waiver = 1 + int(room);
          l.adjusted += waiver;
          adjustments += waiver;
        } else {
          const l = lines[int(lines.length)];
          // A refund gives collected money back for what was overcharged:
          // the line owes less and was paid less, so its balance stays.
          const room = Math.min(l.allocated - l.refunded, l.net - l.adjusted);
          if (room <= 0) continue;
          const r = 1 + int(room);
          l.refunded += r;
          l.adjusted += r;
          adjustments += r;
          refunded += r;
        }

        const outstanding = lines.reduce((n, l) => n + lineOutstanding(l), 0);
        expect(billed - discounts - adjustments - (collected - refunded)).toBe(
          outstanding,
        );
        for (const l of lines) {
          expect(lineOutstanding(l)).toBeGreaterThanOrEqual(0);
          expect(lineOutstanding(l)).toBe(
            l.net - l.adjusted - l.allocated + l.refunded,
          );
        }
      }
    },
  );
});
