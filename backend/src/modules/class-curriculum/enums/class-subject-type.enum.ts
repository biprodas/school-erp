/** How a class takes a subject in a session (PRD 6.4). */
export enum ClassSubjectType {
  COMPULSORY = 'compulsory',
  /** Choose-one, e.g. religion. */
  OPTIONAL = 'optional',
  /** The BD "4th subject" (counted above GPA 2.0 only). */
  FOURTH = 'fourth',
  ELECTIVE = 'elective',
}

/** Types a student may pick as their 4th subject. */
export const FOURTH_SUBJECT_TYPES: readonly ClassSubjectType[] = [
  ClassSubjectType.FOURTH,
  ClassSubjectType.OPTIONAL,
];
