/**
 * Grading templates (PRD 6.9). Data only until grading systems exist (M5),
 * which adds the "apply" step; listed now so onboarding can show them.
 */
export interface GradingTemplate {
  code: string;
  name: string;
  /** Highest grade point. */
  scale: number;
  /** From the highest band down; `min` and `max` are percentages. */
  bands: { grade: string; min: number; max: number; point: number }[];
}

/** Bangladesh SSC/HSC GPA 5.0 (the default, PRD 6.2 step 5). */
export const BD_GPA_5_TEMPLATE: GradingTemplate = {
  code: 'bd-gpa-5',
  name: 'Bangladesh GPA 5.0',
  scale: 5,
  bands: [
    { grade: 'A+', min: 80, max: 100, point: 5 },
    { grade: 'A', min: 70, max: 79, point: 4 },
    { grade: 'A-', min: 60, max: 69, point: 3.5 },
    { grade: 'B', min: 50, max: 59, point: 3 },
    { grade: 'C', min: 40, max: 49, point: 2 },
    { grade: 'D', min: 33, max: 39, point: 1 },
    { grade: 'F', min: 0, max: 32, point: 0 },
  ],
};

export const GRADING_TEMPLATES: GradingTemplate[] = [BD_GPA_5_TEMPLATE];
