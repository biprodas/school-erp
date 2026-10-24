import { DiscountKind, FeeFrequency, FineKind } from '../enums/fee.enum';

/**
 * The arithmetic of fees (PRD 6.10), pure so the fee regression suite can
 * pin it. Money is integer minor units (poisha) everywhere: no floats.
 */

/** `amount × basisPoints / 10 000`, rounded down (the school never overcharges). */
export function percentOf(amount: number, basisPoints: number): number {
  return Math.floor((amount * basisPoints) / 10_000);
}

export interface DiscountRule {
  /** The discount type, for the line's breakdown. */
  id: string;
  kind: DiscountKind;
  /** Basis points for percent, minor units for fixed. */
  value: number;
}

/**
 * Discounts on one fee line: each rule on the full amount (they don't
 * compound), the sum capped at the amount. Returns each rule's share.
 */
export function discountsFor(
  amount: number,
  rules: DiscountRule[],
): { total: number; parts: { id: string; amount: number }[] } {
  const parts: { id: string; amount: number }[] = [];
  let left = amount;
  for (const r of rules) {
    const raw =
      r.kind === DiscountKind.PERCENT ? percentOf(amount, r.value) : r.value;
    const given = Math.max(0, Math.min(raw, left));
    if (given > 0) parts.push({ id: r.id, amount: given });
    left -= given;
  }
  return { total: amount - left, parts };
}

/** `YYYY-MM` → the month number (1–12). */
export const monthOf = (period: string) => Number(period.slice(5, 7));

/** Periods (`YYYY-MM`) from `from` to `to`, inclusive. */
export function periodsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/**
 * Whether a structure item bills in `period`. `months` lists the calendar
 * months it bills in; without it: monthly → every month of the session,
 * quarterly → every third month from the session's first, yearly and one
 * time → the session's first month.
 */
export function billsIn(
  frequency: FeeFrequency,
  months: number[] | null,
  period: string,
  session: { startPeriod: string; endPeriod: string },
): boolean {
  if (period < session.startPeriod || period > session.endPeriod) return false;
  const month = monthOf(period);
  if (months?.length) return months.includes(month);
  const index = periodsBetween(session.startPeriod, period).length - 1;
  switch (frequency) {
    case FeeFrequency.MONTHLY:
      return true;
    case FeeFrequency.QUARTERLY:
      return index % 3 === 0;
    default:
      return index === 0;
  }
}

/** The due date of a period's invoice: `dueDay` of the month (1–28). */
export const dueDateFor = (period: string, dueDay: number) =>
  `${period}-${String(Math.min(Math.max(dueDay, 1), 28)).padStart(2, '0')}`;

/** Whole days from `from` to `to` (`YYYY-MM-DD`); negative when earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}

export interface FineRule {
  kind: FineKind;
  amount: number;
  graceDays: number;
  maxAmount: number | null;
}

/**
 * The late fine an invoice owes on `today`: nothing within the grace
 * period after the due date, then the fixed amount, or the daily amount
 * for each day past the grace period, capped at `maxAmount`.
 */
export function fineFor(
  rule: FineRule,
  dueDate: string,
  today: string,
): number {
  const late = daysBetween(dueDate, today) - rule.graceDays;
  if (late <= 0) return 0;
  const raw = rule.kind === FineKind.FIXED ? rule.amount : rule.amount * late;
  return rule.maxAmount === null ? raw : Math.min(raw, rule.maxAmount);
}

/** What a line still owes. */
export interface LineBalance {
  net: number;
  adjusted: number;
  allocated: number;
  refunded: number;
}

/** Outstanding = net − adjustments − (collected − refunded). */
export const lineOutstanding = (l: LineBalance) =>
  l.net - l.adjusted - l.allocated + l.refunded;

export interface AllocatableLine {
  id: string;
  outstanding: number;
  /** Oldest due first, then `order`. */
  dueDate: string;
  order: number;
}

export class AllocationError extends Error {
  constructor(
    readonly code:
      | 'ALLOCATION_EXCEEDS_PAYMENT'
      | 'ALLOCATION_EXCEEDS_LINE'
      | 'UNKNOWN_LINE'
      | 'PAYMENT_EXCEEDS_DUE'
      | 'PAYMENT_NOT_ALLOCATED',
    message: string,
    readonly lineId?: string,
  ) {
    super(message);
  }
}

/**
 * Spreads a payment over invoice lines: as given (each at most the line's
 * outstanding, together exactly the payment), or oldest due first. A
 * payment must be fully allocated: more than what is due is refused.
 */
export function allocate(
  amount: number,
  lines: AllocatableLine[],
  given?: { lineId: string; amount: number }[],
): { lineId: string; amount: number }[] {
  const byId = new Map(lines.map((l) => [l.id, l]));
  if (given?.length) {
    const totals = new Map<string, number>();
    for (const g of given) {
      const line = byId.get(g.lineId);
      if (!line)
        throw new AllocationError(
          'UNKNOWN_LINE',
          'Not an open line of these students',
          g.lineId,
        );
      totals.set(g.lineId, (totals.get(g.lineId) ?? 0) + g.amount);
      if (totals.get(g.lineId)! > line.outstanding) {
        throw new AllocationError(
          'ALLOCATION_EXCEEDS_LINE',
          'More than the line still owes',
          g.lineId,
        );
      }
    }
    const sum = given.reduce((n, g) => n + g.amount, 0);
    if (sum > amount) {
      throw new AllocationError(
        'ALLOCATION_EXCEEDS_PAYMENT',
        'The allocations add up to more than the payment',
      );
    }
    if (sum < amount) {
      throw new AllocationError(
        'PAYMENT_NOT_ALLOCATED',
        'Allocate the whole payment',
      );
    }
    return [...totals].map(([lineId, a]) => ({ lineId, amount: a }));
  }
  const due = lines.reduce((n, l) => n + Math.max(0, l.outstanding), 0);
  if (amount > due) {
    throw new AllocationError('PAYMENT_EXCEEDS_DUE', `Only ${due} is due`);
  }
  const ordered = [...lines]
    .filter((l) => l.outstanding > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.order - b.order);
  const out: { lineId: string; amount: number }[] = [];
  let left = amount;
  for (const l of ordered) {
    if (!left) break;
    const take = Math.min(left, l.outstanding);
    out.push({ lineId: l.id, amount: take });
    left -= take;
  }
  return out;
}

export type AgingBucket = 'current' | '0-30' | '31-60' | '61-90' | '90+';

/** The aging bucket of a due amount by days past its due date. */
export function agingBucket(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return '0-30';
  if (daysOverdue <= 60) return '31-60';
  if (daysOverdue <= 90) return '61-90';
  return '90+';
}
