export enum FeeFrequency {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  ONE_TIME = 'one_time',
}

export enum DiscountKind {
  /** `value` in basis points: 1000 = 10.00%. */
  PERCENT = 'percent',
  /** `value` in minor units, per fee line it applies to. */
  FIXED = 'fixed',
}

export enum DiscountCode {
  SIBLING = 'sibling',
  MERIT = 'merit',
  STAFF_CHILD = 'staff_child',
  FREEDOM_FIGHTER = 'freedom_fighter',
  CUSTOM = 'custom',
}

/** Discounts and adjustments wait for `fees:approve_waiver`. */
export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum FineKind {
  /** `amount` once the grace period is over. */
  FIXED = 'fixed',
  /** `amount` per day past the grace period, up to `maxAmount`. */
  PER_DAY = 'per_day',
}

export enum InvoiceKind {
  /** Made by monthly generation from the fee structures. */
  GENERATED = 'generated',
  /** Entered by hand (fines, events). */
  ADHOC = 'adhoc',
}

export enum InvoiceStatus {
  OPEN = 'open',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

export enum InvoiceLineKind {
  /** A fee head from the structure (one per student, head and period). */
  FEE = 'fee',
  /** A late fine, one per rule and invoice. */
  FINE = 'fine',
  /** A hand-entered line. */
  ADHOC = 'adhoc',
}

export enum PaymentChannel {
  CASH = 'cash',
  CHEQUE = 'cheque',
  CARD = 'card',
  BANK_SLIP = 'bank_slip',
}

export enum PaymentStatus {
  COMPLETED = 'completed',
  REVERSED = 'reversed',
}

export enum ReceiptStatus {
  VALID = 'valid',
  CANCELLED = 'cancelled',
}

export enum AdjustmentType {
  /** Money given back to the payer: lowers what was collected. */
  REFUND = 'refund',
  /** Forgiven: lowers what is due. */
  WAIVER = 'waiver',
  /** Signed: positive lowers what is due, negative raises it. */
  CORRECTION = 'correction',
}

export enum LedgerAccount {
  CASH = 'cash',
  BANK = 'bank',
}

export enum LedgerDirection {
  INCOME = 'income',
  EXPENSE = 'expense',
}
