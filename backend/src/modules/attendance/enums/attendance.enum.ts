/** What a status means for counts and percentages. */
export enum CountsAs {
  PRESENT = 'present',
  ABSENT = 'absent',
  LATE = 'late',
  LEAVE = 'leave',
  HALF_DAY = 'half_day',
}

/** Why a submitted record changed. */
export enum CorrectionSource {
  /** Someone edited the register. */
  MANUAL = 'manual',
  /** An offline submission overwrote a newer one (Phase 1b sync). */
  SYNC_OVERWRITE = 'sync_overwrite',
  /** An approved leave request set the day to Leave. */
  LEAVE_APPROVAL = 'leave_approval',
}

export enum StudentLeaveStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  /** Withdrawn while still pending. */
  CANCELLED = 'cancelled',
}

/** A status as the API shows it: the system ones plus the school's own. */
export interface AttendanceStatusView {
  code: string;
  labelEn: string;
  labelBn: string;
  countsAs: CountsAs;
  /** Shown in the monthly register grid, e.g. `P`. */
  symbol: string;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
  /** Set on custom statuses only. */
  id?: string;
}

export const PRESENT = 'present';
export const LEAVE = 'leave';

/**
 * The five statuses every school has (PRD 6.7). Code-defined, like the
 * permission catalog, so their codes never change; schools add their own
 * in `attendance_statuses`.
 */
export const SYSTEM_STATUSES: readonly AttendanceStatusView[] = [
  {
    code: PRESENT,
    labelEn: 'Present',
    labelBn: 'উপস্থিত',
    countsAs: CountsAs.PRESENT,
    symbol: 'P',
    sortOrder: 1,
  },
  {
    code: 'absent',
    labelEn: 'Absent',
    labelBn: 'অনুপস্থিত',
    countsAs: CountsAs.ABSENT,
    symbol: 'A',
    sortOrder: 2,
  },
  {
    code: 'late',
    labelEn: 'Late',
    labelBn: 'বিলম্ব',
    countsAs: CountsAs.LATE,
    symbol: 'L',
    sortOrder: 3,
  },
  {
    code: LEAVE,
    labelEn: 'Leave',
    labelBn: 'ছুটি',
    countsAs: CountsAs.LEAVE,
    symbol: 'LV',
    sortOrder: 4,
  },
  {
    code: 'half_day',
    labelEn: 'Half-day',
    labelBn: 'অর্ধদিবস',
    countsAs: CountsAs.HALF_DAY,
    symbol: 'H',
    sortOrder: 5,
  },
].map((s) => ({ ...s, isSystem: true, isActive: true }));

export const SYSTEM_STATUS_CODES: ReadonlySet<string> = new Set(
  SYSTEM_STATUSES.map((s) => s.code),
);
