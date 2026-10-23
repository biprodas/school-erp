export enum NoteType {
  GENERAL = 'general',
  ACADEMIC = 'academic',
  BEHAVIOR = 'behavior',
  HEALTH = 'health',
  DISCIPLINARY = 'disciplinary',
  COUNSELLING = 'counselling',
  OTHER = 'other',
}

/**
 * Notes only `student_notes:read_sensitive` reaches (PRD 6.6); reading
 * them is audited.
 */
export const SENSITIVE_NOTE_TYPES: readonly NoteType[] = [
  NoteType.HEALTH,
  NoteType.DISCIPLINARY,
  NoteType.COUNSELLING,
];
