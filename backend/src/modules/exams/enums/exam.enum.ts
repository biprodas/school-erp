export enum ExamStatus {
  /** Being set up: subjects and marks schemes change freely. */
  DRAFT = 'draft',
  /** Mark sheets exist and marks are entered. */
  OPEN = 'open',
}

/** The mark-sheet workflow (PRD 6.9): Draft → Submitted → (Verified) → Approved → Published. */
export enum MarkSheetStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  VERIFIED = 'verified',
  APPROVED = 'approved',
  PUBLISHED = 'published',
}

/** Sheets whose marks are final for tabulation. */
export const FINAL_SHEET_STATUSES: readonly MarkSheetStatus[] = [
  MarkSheetStatus.APPROVED,
  MarkSheetStatus.PUBLISHED,
];

export enum ResultSheetType {
  MERIT = 'merit',
  TABULATION = 'tabulation',
  FAILED = 'failed',
  ANALYSIS = 'analysis',
}
