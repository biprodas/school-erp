/**
 * The grading engine's types (PRD 6.9). The engine is plain TypeScript with
 * no Nest or database dependencies: callers turn marks into these inputs
 * and store what comes back.
 */

export type GradingKind = 'gpa' | 'letter' | 'percentage';

/** One band of a grade scale, by percentage of full marks. */
export interface GradeBand {
  letter: string;
  /** Lowest percentage in the band (inclusive). */
  minPercent: number;
  /** Highest percentage in the band (shown on scales; lookup uses `minPercent`). */
  maxPercent: number;
  point: number;
  isFail: boolean;
}

/** Percentage schemes: a division by overall percentage. */
export interface Division {
  name: string;
  minPercent: number;
}

export interface GradingRules {
  /** Fractional subject totals: kept, rounded up (BD boards) or to nearest. */
  markRounding: 'none' | 'up' | 'nearest';
  /** Every component must reach its own pass mark (CQ, MCQ, practical). */
  componentPass: boolean;
  /** A failed subject that counts (all but the 4th) fails the result. */
  failedSubjectFailsResult: boolean;
  /** The BD 4th subject: only its points above `threshold` are added. */
  fourthSubject: { enabled: boolean; threshold: number };
  /** Highest GPA (5.00 in BD); null = no cap. */
  gpaCap: number | null;
  gpaRounding: 'round' | 'truncate';
  /** Marks added only to reach a pass; null = no grace. */
  grace: { perSubject: number; total: number } | null;
  /** Percentage schemes: divisions, any order. */
  divisions: Division[];
  /** Overall grade of a failed result. */
  failGrade: string;
}

export interface GradingScheme {
  kind: GradingKind;
  bands: GradeBand[];
  rules: GradingRules;
}

/** One component's mark (CQ, MCQ, …). */
export interface ComponentMark {
  code: string;
  fullMarks: number;
  passMarks: number | null;
  /** Null when absent, exempt or not entered (counts as 0). */
  value: number | null;
  absent?: boolean;
  exempt?: boolean;
}

/** A student's marks in one subject. */
export interface SubjectInput {
  /** The class subject id. */
  id: string;
  fullMarks: number;
  /** Pass mark on the subject total; null = the scale's pass band only. */
  passMarks: number | null;
  components: ComponentMark[];
  /** The student's 4th subject. */
  isFourth?: boolean;
  /** Counts in the compulsory total (merit tie-breaker). */
  compulsory?: boolean;
}

export interface ComponentResult {
  code: string;
  fullMarks: number;
  value: number | null;
  absent: boolean;
  exempt: boolean;
  passed: boolean;
}

export interface SubjectResult {
  id: string;
  /** After rounding and grace. */
  marks: number;
  /** As entered (sum of components). */
  rawMarks: number;
  /** Full marks of the components not exempt. */
  fullMarks: number;
  percentage: number;
  /** Null when exempt. */
  letter: string | null;
  point: number | null;
  passed: boolean;
  /** Absent in every component. */
  absent: boolean;
  /** Exempt in every component: left out of totals and GPA. */
  exempt: boolean;
  grace: number;
  /** Components below their own pass mark. */
  failedComponents: string[];
  components: ComponentResult[];
  isFourth: boolean;
  compulsory: boolean;
}

export interface OverallResult {
  subjects: SubjectResult[];
  /** Marks of every subject not exempt. */
  total: number;
  fullMarks: number;
  percentage: number;
  compulsoryTotal: number;
  /** GPA and letter schemes; null for percentage schemes. */
  gpa: number | null;
  gpaWithoutFourth: number | null;
  /** Letter for GPA/letter schemes, division for percentage ones. */
  grade: string;
  passed: boolean;
  /** Failed subjects that count (not the 4th). */
  failedCount: number;
  graceUsed: number;
}
