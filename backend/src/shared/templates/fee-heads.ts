/**
 * Default fee heads (PRD 6.2 step 6), added by
 * `POST /onboarding/templates/fee-heads/apply`.
 */
export interface FeeHeadTemplate {
  name: string;
  /** How often it is usually billed. */
  frequency: 'once' | 'monthly' | 'yearly' | 'per_exam';
}

export const DEFAULT_FEE_HEADS: FeeHeadTemplate[] = [
  { name: 'Admission Fee', frequency: 'once' },
  { name: 'Session Fee', frequency: 'yearly' },
  { name: 'Tuition Fee', frequency: 'monthly' },
  { name: 'Exam Fee', frequency: 'per_exam' },
  { name: 'Lab Fee', frequency: 'yearly' },
  { name: 'Library Fee', frequency: 'yearly' },
  { name: 'Sports Fee', frequency: 'yearly' },
  { name: 'ID Card Fee', frequency: 'once' },
  { name: 'Development Fee', frequency: 'yearly' },
  { name: 'Transport Fee', frequency: 'monthly' },
];
