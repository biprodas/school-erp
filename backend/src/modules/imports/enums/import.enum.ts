/** What an import creates. A `guardians`-only import comes later. */
export enum ImportType {
  STUDENTS = 'students',
  STAFF = 'staff',
  /** One mark sheet's marks (M5). */
  MARKS = 'marks',
}

export enum ImportStatus {
  UPLOADED = 'uploaded',
  VALIDATING = 'validating',
  VALIDATED = 'validated',
  COMMITTING = 'committing',
  DONE = 'done',
  FAILED = 'failed',
}

export enum ImportMode {
  /** One transaction: any row error, nothing is saved. */
  ALL_OR_NOTHING = 'all_or_nothing',
  /** Saves the valid rows, each on its own savepoint. */
  VALID_ONLY = 'valid_only',
}
