export enum PromotionBatchStatus {
  DRAFT = 'draft',
  COMMITTED = 'committed',
  ROLLED_BACK = 'rolled_back',
}

export enum PromotionOutcome {
  PROMOTE = 'promote',
  /** Repeats the class next session. */
  DETAIN = 'detain',
  /** Moves up on conditions (e.g. passing a re-sit). */
  CONDITIONAL = 'conditional',
  /** Final class: leaves as graduated. */
  GRADUATE = 'graduate',
}

/** How new rolls are given in each target section. */
export enum RollBy {
  /** By the combined result (M5); until results exist, by the old roll. */
  MERIT = 'merit',
  /** The old roll stays. */
  KEEP = 'keep',
  ALPHABETICAL = 'alphabetical',
}

/** A committed batch can be rolled back for this long (PRD 6.6). */
export const ROLLBACK_WINDOW_MS = 24 * 60 * 60 * 1000;
